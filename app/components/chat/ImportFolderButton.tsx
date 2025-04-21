import React, { useState } from 'react';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { logStore } from '~/lib/stores/logs';
import { workbenchStore } from '~/lib/stores/workbench';

interface ImportFolderButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  onDirectorySelect?: (handle: FileSystemDirectoryHandle) => void;
}

export const ImportFolderButton: React.FC<ImportFolderButtonProps> = ({ className, importChat, onDirectorySelect }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDirectoryPick = async () => {
    try {
      setIsLoading(true);

      const handle = await window.showDirectoryPicker();

      // Workbenchの表示状態を設定
      workbenchStore.setShowWorkbench(true);
      workbenchStore.currentView.set('code');

      if (onDirectorySelect) {
        onDirectorySelect(handle);
      }

      logStore.logSystem('Directory selected successfully');
      toast.success('Directory selected successfully');
    } catch (error) {
      logStore.logError('Failed to select directory', error);
      console.error('Failed to select directory:', error);
      toast.error('Failed to select directory');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDirectoryPick}
      title="Import Folder"
      variant="outline"
      size="lg"
      className={classNames(
        'gap-2 bg-[#F5F5F5] dark:bg-[#252525]',
        'text-bolt-elements-textPrimary dark:text-white',
        'hover:bg-[#E5E5E5] dark:hover:bg-[#333333]',
        'border-[#E5E5E5] dark:border-[#333333]',
        'h-10 px-4 py-2 min-w-[120px] justify-center',
        'transition-all duration-200 ease-in-out',
        className,
      )}
      disabled={isLoading}
    >
      <span className="i-ph:upload-simple w-4 h-4" />
      {isLoading ? 'Selecting...' : 'Import Folder'}
    </Button>
  );
};
