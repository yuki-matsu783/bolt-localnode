import React, { useState } from 'react';
import FileExplorer from './FileExplorer';

interface Props {
  chatStarted: boolean;
  isStreaming: boolean;
  children?: React.ReactNode;
}

type TabType = 'chat' | 'preview';

export const Workbench = React.memo<Props>(({ chatStarted, isStreaming, children }) => {
  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex h-full">
        {chatStarted && (
          <div className="w-[1000px] border-l border-bolt-elements-borderColor">
            <FileExplorer />
          </div>
        )}
      </div>
    </div>
  );
});
