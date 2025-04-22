// CodeMirrorをReactコンポーネントとして実装するメインファイル
import { acceptCompletion, autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { Compartment, EditorSelection, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  scrollPastEnd,
  showTooltip,
  tooltips,
  type Tooltip,
} from '@codemirror/view';
import { memo, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Theme } from '~/types/theme';
import { classNames } from '~/utils/classNames';
import { debounce } from '~/utils/debounce';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BinaryContent } from './BinaryContent';
import { getTheme, reconfigureTheme } from './cm-theme';
import { indentKeyBinding } from './indent';
import { getLanguage } from './languages';

const logger = createScopedLogger('CodeMirrorEditor');

// エディタードキュメントインターフェース：編集対象ファイルの情報を定義
export interface EditorDocument {
  value: string;      // ファイルの内容
  isBinary: boolean;  // バイナリファイルかどうかのフラグ
  filePath: string;   // ファイルの絶対パス
  scroll?: ScrollPosition;  // スクロール位置情報（オプショナル）
}

// エディター設定インターフェース：表示に関する設定を定義
export interface EditorSettings {
  fontSize?: string;        // エディターのフォントサイズ
  gutterFontSize?: string; // 行番号等のガター部分のフォントサイズ
  tabSize?: number;        // タブのスペース数
}

// テキストファイル用のドキュメントタイプ
type TextEditorDocument = EditorDocument & {
  value: string;  // テキストコンテンツ
};

// スクロール位置を管理するインターフェース
export interface ScrollPosition {
  top: number;   // 上からのスクロール位置
  left: number;  // 左からのスクロール位置
}

// エディターの更新情報インターフェース
export interface EditorUpdate {
  selection: EditorSelection;  // 現在の選択範囲
  content: string;            // 更新後のコンテンツ
}

// 各種コールバック関数の型定義
export type OnChangeCallback = (update: EditorUpdate) => void;      // 内容変更時の処理
export type OnScrollCallback = (position: ScrollPosition) => void;   // スクロール時の処理
export type OnSaveCallback = () => void;                            // 保存時の処理

// エディターコンポーネントのProps
interface Props {
  theme: Theme;                        // エディターのテーマ（ダーク/ライト）
  id?: unknown;                        // エディターの一意識別子
  doc?: EditorDocument;                // 編集対象のドキュメント
  editable?: boolean;                  // 編集可能かどうか
  debounceChange?: number;             // 変更イベントの遅延時間（ms）
  debounceScroll?: number;             // スクロールイベントの遅延時間（ms）
  autoFocusOnDocumentChange?: boolean; // ドキュメント変更時に自動フォーカスするか
  onChange?: OnChangeCallback;         // 内容変更時のコールバック
  onScroll?: OnScrollCallback;         // スクロール時のコールバック
  onSave?: OnSaveCallback;            // 保存時のコールバック
  className?: string;                  // 追加のCSSクラス
  settings?: EditorSettings;           // エディター表示設定
}

// エディターの状態を保持するためのMap型
type EditorStates = Map<string, EditorState>;

// 読み取り専用モード時のツールチップ表示制御用のStateEffect
const readOnlyTooltipStateEffect = StateEffect.define<boolean>();

// 読み取り専用モード時のツールチップ表示を管理するStateField
const editableTooltipField = StateField.define<readonly Tooltip[]>({
  create: () => [], // 初期状態は空
  update(_tooltips, transaction) {
    // 読み取り専用でない場合は何も表示しない
    if (!transaction.state.readOnly) {
      return [];
    }

    // ESCキー以外のキー入力で読み取り専用警告を表示
    for (const effect of transaction.effects) {
      if (effect.is(readOnlyTooltipStateEffect) && effect.value) {
        return getReadOnlyTooltip(transaction.state);
      }
    }

    return [];
  },
  provide: (field) => {
    return showTooltip.computeN([field], (state) => state.field(field));
  },
});

// 編集可能状態を制御するStateEffect
const editableStateEffect = StateEffect.define<boolean>();

// 編集可能状態を管理するStateField
const editableStateField = StateField.define<boolean>({
  create() {
    return true;  // デフォルトは編集可能
  },
  update(value, transaction) {
    // editableStateEffectが発生した場合はその値を使用
    for (const effect of transaction.effects) {
      if (effect.is(editableStateEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

// CodeMirrorエディターの実装（メモ化コンポーネント）
export const CodeMirrorEditor = memo(
  ({
    id,
    doc,
    debounceScroll = 100,
    debounceChange = 150,
    autoFocusOnDocumentChange = false,
    editable = true,
    onScroll,
    onChange,
    onSave,
    theme,
    settings,
    className = '',
  }: Props) => {
    renderLogger.trace('CodeMirrorEditor');

    // 言語サポート用のCompartment（言語に応じた構文ハイライト等の機能を提供）
    const [languageCompartment] = useState(new Compartment());

    // 各種参照を保持するためのRef
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView>();
    const themeRef = useRef<Theme>();
    const docRef = useRef<EditorDocument>();
    const editorStatesRef = useRef<EditorStates>();
    const onScrollRef = useRef(onScroll);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);

    /**
     * このエフェクトは、レンダー関数内での副作用を避けるために使用され、
     * 各レンダー後にRefが更新される。
     */
    useEffect(() => {
      onScrollRef.current = onScroll;
      onChangeRef.current = onChange;
      onSaveRef.current = onSave;
      docRef.current = doc;
      themeRef.current = theme;
    });

    useEffect(() => {
      const onUpdate = debounce((update: EditorUpdate) => {
        onChangeRef.current?.(update);
      }, debounceChange);

      const view = new EditorView({
        parent: containerRef.current!,
        dispatchTransactions(transactions) {
          const previousSelection = view.state.selection;

          view.update(transactions);

          const newSelection = view.state.selection;

          const selectionChanged =
            newSelection !== previousSelection &&
            (newSelection === undefined || previousSelection === undefined || !newSelection.eq(previousSelection));

          if (docRef.current && (transactions.some((transaction) => transaction.docChanged) || selectionChanged)) {
            onUpdate({
              selection: view.state.selection,
              content: view.state.doc.toString(),
            });

            editorStatesRef.current!.set(docRef.current.filePath, view.state);
          }
        },
      });

      viewRef.current = view;

      return () => {
        viewRef.current?.destroy();
        viewRef.current = undefined;
      };
    }, []);

    useEffect(() => {
      if (!viewRef.current) {
        return;
      }

      viewRef.current.dispatch({
        effects: [reconfigureTheme(theme)],
      });
    }, [theme]);

    useEffect(() => {
      editorStatesRef.current = new Map<string, EditorState>();
    }, [id]);

    useEffect(() => {
      const editorStates = editorStatesRef.current!;
      const view = viewRef.current!;
      const theme = themeRef.current!;

      if (!doc) {
        const state = newEditorState('', theme, settings, onScrollRef, debounceScroll, onSaveRef, [
          languageCompartment.of([]),
        ]);

        view.setState(state);

        setNoDocument(view);

        return;
      }

      if (doc.isBinary) {
        return;
      }

      if (doc.filePath === '') {
        logger.warn('File path should not be empty');
      }

      let state = editorStates.get(doc.filePath);

      if (!state) {
        state = newEditorState(doc.value, theme, settings, onScrollRef, debounceScroll, onSaveRef, [
          languageCompartment.of([]),
        ]);

        editorStates.set(doc.filePath, state);
      }

      view.setState(state);

      setEditorDocument(
        view,
        theme,
        editable,
        languageCompartment,
        autoFocusOnDocumentChange,
        doc as TextEditorDocument,
      );
    }, [doc?.value, editable, doc?.filePath, autoFocusOnDocumentChange]);

    return (
      <div className={classNames('relative h-full', className)}>
        {doc?.isBinary && <BinaryContent />}
        <div className="h-full overflow-hidden" ref={containerRef} />
      </div>
    );
  },
);

export default CodeMirrorEditor;

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

// 新しいエディター状態を作成する関数
function newEditorState(
  content: string,
  theme: Theme,
  settings: EditorSettings | undefined,
  onScrollRef: MutableRefObject<OnScrollCallback | undefined>,
  debounceScroll: number,
  onFileSaveRef: MutableRefObject<OnSaveCallback | undefined>,
  extensions: Extension[],
) {
  return EditorState.create({
    doc: content,
    extensions: [
      EditorView.domEventHandlers({
        scroll: debounce((event, view) => {
          if (event.target !== view.scrollDOM) {
            return;
          }

          onScrollRef.current?.({ left: view.scrollDOM.scrollLeft, top: view.scrollDOM.scrollTop });
        }, debounceScroll),
        keydown: (event, view) => {
          if (view.state.readOnly) {
            view.dispatch({
              effects: [readOnlyTooltipStateEffect.of(event.key !== 'Escape')],
            });

            return true;
          }

          return false;
        },
      }),
      getTheme(theme, settings),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        { key: 'Tab', run: acceptCompletion },
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onFileSaveRef.current?.();
            return true;
          },
        },
        indentKeyBinding,
      ]),
      indentUnit.of('\t'),
      autocompletion({
        closeOnBlur: false,
      }),
      tooltips({
        position: 'absolute',
        parent: document.body,
        tooltipSpace: (view) => {
          const rect = view.dom.getBoundingClientRect();

          return {
            top: rect.top - 50,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right + 10,
          };
        },
      }),
      closeBrackets(),
      lineNumbers(),
      scrollPastEnd(),
      dropCursor(),
      drawSelection(),
      bracketMatching(),
      EditorState.tabSize.of(settings?.tabSize ?? 2),
      indentOnInput(),
      editableTooltipField,
      editableStateField,
      EditorState.readOnly.from(editableStateField, (editable) => !editable),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      foldGutter({
        markerDOM: (open) => {
          const icon = document.createElement('div');

          icon.className = `fold-icon ${open ? 'i-ph-caret-down-bold' : 'i-ph-caret-right-bold'}`;

          return icon;
        },
      }),
      ...extensions,
    ],
  });
}

// ドキュメントがない状態を設定する関数
function setNoDocument(view: EditorView) {
  view.dispatch({
    selection: { anchor: 0 },
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: '',
    },
  });

  view.scrollDOM.scrollTo(0, 0);
}

// エディタードキュメントを設定する関数
function setEditorDocument(
  view: EditorView,
  theme: Theme,
  editable: boolean,
  languageCompartment: Compartment,
  autoFocus: boolean,
  doc: TextEditorDocument,
) {
  if (doc.value !== view.state.doc.toString()) {
    view.dispatch({
      selection: { anchor: 0 },
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: doc.value,
      },
    });
  }

  view.dispatch({
    effects: [editableStateEffect.of(editable && !doc.isBinary)],
  });

  getLanguage(doc.filePath).then((languageSupport) => {
    if (!languageSupport) {
      return;
    }

    view.dispatch({
      effects: [languageCompartment.reconfigure([languageSupport]), reconfigureTheme(theme)],
    });

    requestAnimationFrame(() => {
      const currentLeft = view.scrollDOM.scrollLeft;
      const currentTop = view.scrollDOM.scrollTop;
      const newLeft = doc.scroll?.left ?? 0;
      const newTop = doc.scroll?.top ?? 0;

      const needsScrolling = currentLeft !== newLeft || currentTop !== newTop;

      if (autoFocus && editable) {
        if (needsScrolling) {
          // スクロール位置が変更されるまでフォーカスを待つ
          view.scrollDOM.addEventListener(
            'scroll',
            () => {
              view.focus();
            },
            { once: true },
          );
        } else {
          // スクロール位置が同じ場合は即座にフォーカス
          view.focus();
        }
      }

      view.scrollDOM.scrollTo(newLeft, newTop);
    });
  });
}

// 読み取り専用ツールチップを取得する関数
function getReadOnlyTooltip(state: EditorState) {
  if (!state.readOnly) {
    return [];
  }

  return state.selection.ranges
    .filter((range) => {
      return range.empty;
    })
    .map((range) => {
      return {
        pos: range.head,
        above: true,
        strictSide: true,
        arrow: true,
        create: () => {
          const divElement = document.createElement('div');
          divElement.className = 'cm-readonly-tooltip';
          divElement.textContent = 'Cannot edit file while AI response is being generated';

          return { dom: divElement };
        },
      };
    });
}
