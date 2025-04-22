import { useStore } from '@nanostores/react';
import { memo } from 'react';
import { computed } from 'nanostores';
import { workbenchStore } from '~/lib/stores/workbench';
import { PreviewWorkbench } from './PreviewWorkbench';
import { CodeWorkbench } from './CodeWorkbench';
import type { WorkspaceProps } from '~/components/workbench/types';

export const Workbench = memo(({ chatStarted, isStreaming, actionRunner, metadata, updateChatMestaData }: WorkspaceProps) => {
  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));

  if (!chatStarted) {
    return null;
  }

  if (hasPreview) {
    return <PreviewWorkbench />;
  }

  return (
    <CodeWorkbench
      isStreaming={isStreaming}
      actionRunner={actionRunner}
      metadata={metadata}
      updateChatMestaData={updateChatMestaData}
    />
  );
});
