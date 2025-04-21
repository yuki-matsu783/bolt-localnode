import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Tree } from 'react-arborist';
import { Box } from '@mui/material';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';

interface FileEntry {
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  path: string;
  type: 'file' | 'directory';
  name: string;
  children?: Record<string, FileEntry>;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

const isTextFile = async (fileHandle: FileSystemFileHandle) => {
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();

    return typeof text === 'string';
  } catch {
    return false;
  }
};

const getLanguageFromFileName = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    json: 'json',
    md: 'markdown',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  };

  return languageMap[ext] || 'plaintext';
};

export default function FileExplorer() {
  const [fileEntries, setFileEntries] = useState<Record<string, FileEntry>>({});
  const [selectedFile, setSelectedFile] = useState<{
    filename: string;
    code: string;
    language: string;
    isModified: boolean;
  }>({
    filename: '',
    code: '',
    language: 'plaintext',
    isModified: false,
  });
  const [editedFiles, setEditedFiles] = useState<
    Record<
      string,
      {
        code: string;
        language: string;
        isModified: boolean;
      }
    >
  >({});
  const [logs, setLogs] = useState<string[]>([]);
  const [treeSize, setTreeSize] = useState({ width: 0, height: 0 });
  const treeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTreeSize = () => {
      if (treeContainerRef.current) {
        setTreeSize({
          width: treeContainerRef.current.clientWidth,
          height: treeContainerRef.current.clientHeight,
        });
      }
    };

    updateTreeSize();
    window.addEventListener('resize', updateTreeSize);

    return () => window.removeEventListener('resize', updateTreeSize);
  }, []);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleEditorBeforeMount = (monaco: any) => {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || '';
    setSelectedFile({
      ...selectedFile,
      code: newCode,
      isModified: true,
    });

    setEditedFiles({
      ...editedFiles,
      [selectedFile.filename]: {
        code: newCode,
        language: selectedFile.language,
        isModified: true,
      },
    });
  };

  const scanDirectory = async (dirHandle: FileSystemDirectoryHandle, path = ''): Promise<Record<string, FileEntry>> => {
    const entries: Record<string, FileEntry> = {};

    const directoryEntries = (dirHandle as any).entries();

    for await (const [name, entry] of directoryEntries) {
      if (name.startsWith('.')) {
        continue;
      }

      const fullPath = path ? `${path}/${name}` : name;

      if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle;

        if (await isTextFile(fileHandle)) {
          entries[fullPath] = {
            handle: fileHandle,
            path: fullPath,
            type: 'file',
            name,
          };
        }
      } else if (entry.kind === 'directory') {
        const dirEntry = entry as FileSystemDirectoryHandle;
        const subEntries = await scanDirectory(dirEntry, fullPath);
        entries[fullPath] = {
          handle: dirEntry,
          path: fullPath,
          type: 'directory',
          name,
          children: subEntries,
        };
      }
    }

    return entries;
  };

  const findEntryByPath = (entries: Record<string, FileEntry>, path: string): FileEntry | null => {
    for (const entry of Object.values(entries)) {
      if (entry.path === path) {
        return entry;
      }

      if (entry.type === 'directory' && entry.children) {
        const found = findEntryByPath(entry.children, path);

        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const handleDirectoryPick = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      log('✅ ディレクトリ選択完了');

      const entries = await scanDirectory(handle);
      setFileEntries(entries);
    } catch (e: any) {
      log(`❌ エラー: ${e.message}`);
    }
  };

  const loadFile = async (path: string) => {
    try {
      const editedFile = editedFiles[path];

      if (editedFile) {
        setSelectedFile({
          filename: path,
          ...editedFile,
        });
        log(`📄 ${path} を編集中の状態から復元しました`);

        return;
      }

      const entry = findEntryByPath(fileEntries, path);

      if (!entry) {
        log(`❌ ファイルが見つかりません: ${path}`);
        return;
      }

      if (!entry || entry.type !== 'file') {
        return;
      }

      const fileHandle = entry.handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const text = await file.text();

      setSelectedFile({
        filename: path,
        code: text,
        language: getLanguageFromFileName(path),
        isModified: false,
      });
      log(`📄 ${path} を読み込みました (${text.length}文字)`);
    } catch (e: any) {
      log(`❌ ファイル読み込みエラー: ${e.message}`);
    }
  };

  const saveFile = async () => {
    if (!selectedFile.filename) {
      toast.error('ファイル名が指定されていません');
      return;
    }

    const entry = findEntryByPath(fileEntries, selectedFile.filename);

    if (!entry || entry.type !== 'file') {
      toast.error('保存対象が見つかりません: ' + selectedFile.filename);
      return;
    }

    try {
      const fileHandle = entry.handle as FileSystemFileHandle;
      const writable = await fileHandle.createWritable();
      await writable.write(selectedFile.code);
      await writable.close();

      setSelectedFile({ ...selectedFile, isModified: false });
      setEditedFiles({
        ...editedFiles,
        [selectedFile.filename]: {
          code: selectedFile.code,
          language: selectedFile.language,
          isModified: false,
        },
      });
      toast.success(`${selectedFile.filename} を保存しました`);
    } catch (e: any) {
      toast.error('保存エラー: ' + e.message);
    }
  };

  const convertToTreeData = (entries: Record<string, FileEntry>): TreeNode[] => {
    const buildTree = (entry: FileEntry): TreeNode => {
      const node: TreeNode = {
        id: entry.path,
        name: entry.name,
        type: entry.type,
      };

      if (entry.type === 'directory' && entry.children) {
        node.children = Object.values(entry.children)
          .sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }

            return a.name.localeCompare(b.name);
          })
          .map(buildTree);
      }

      return node;
    };

    return Object.values(entries)
      .filter((entry) => !entry.path.includes('/'))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      })
      .map(buildTree);
  };

  const handleNodeClick = (node: any) => {
    const entry = findEntryByPath(fileEntries, node.id);

    if (entry?.type === 'file') {
      loadFile(entry.path);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button onClick={handleDirectoryPick} className="mr-2">
          ディレクトリを選択
        </Button>
        {selectedFile.filename && (
          <Button
            onClick={saveFile}
            disabled={!selectedFile.isModified}
            variant={selectedFile.isModified ? 'default' : 'ghost'}
          >
            保存
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box
          ref={treeContainerRef}
          sx={{
            width: '25%',
            borderRight: 1,
            borderColor: 'divider',
            p: 2,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {Object.keys(fileEntries).length > 0 && (
            <Tree
              data={convertToTreeData(fileEntries)}
              openByDefault={false}
              width={treeSize.width}
              height={treeSize.height}
              onActivate={(node) => {
                const { type } = node.data;

                if (type === 'directory') {
                  node.toggle();
                } else {
                  handleNodeClick(node.data);
                }
              }}
            >
              {({ node, style, dragHandle }) => (
                <div style={style} ref={dragHandle} className="flex items-center gap-2 py-1 cursor-pointer">
                  <span>{node.data.type === 'file' ? '📄' : node.isOpen ? '📂' : '📁'}</span>
                  <span className="truncate max-w-[180px] text-sm" title={node.data.name}>
                    {node.data.name}
                  </span>
                </div>
              )}
            </Tree>
          )}
        </Box>

        <Box sx={{ width: '75%', p: 2, display: 'flex', flexDirection: 'column' }}>
          {selectedFile.filename && (
            <Box sx={{ mb: 2, typography: 'body2' }}>
              📄 現在のファイル: {selectedFile.filename} ({selectedFile.code.length}文字)
              {selectedFile.isModified && (
                <Box component="span" sx={{ ml: 1, color: 'warning.main' }}>
                  ●
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ flex: 1 }}>
            <Editor
              height="70vh"
              width="100%"
              language={selectedFile.language}
              value={selectedFile.code}
              onChange={handleEditorChange}
              theme="vs-dark"
              beforeMount={handleEditorBeforeMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
                renderValidationDecorations: 'off',
                quickSuggestions: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                selectOnLineNumbers: true,
                roundedSelection: false,
                readOnly: false,
              }}
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  if (selectedFile.isModified) {
                    saveFile();
                  }
                });

                editor.createContextKey('inEditorContext', true);

                editor.onKeyDown((e) => {
                  if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyS) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                });
              }}
            />
          </Box>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', height: '25vh', overflowY: 'auto' }}>
            {logs.map((line, i) => (
              <Box key={i} sx={{ typography: 'body2' }}>
                {line}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
