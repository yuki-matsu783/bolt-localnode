import { useStore } from '@nanostores/react';
import { memo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { workbenchStore } from '~/lib/stores/workbench';
import { Preview } from './Preview';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import useViewport from '~/lib/hooks';

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const PreviewWorkbench = memo(() => {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const isSmallViewport = useViewport(1024);

  return (
    <motion.div
      initial="closed"
      animate={showWorkbench ? 'open' : 'closed'}
      variants={workbenchVariants}
      className="z-workbench"
    >
      <div
        className={classNames(
          'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
          {
            'w-full': isSmallViewport,
            'left-0': showWorkbench && isSmallViewport,
            'left-[var(--workbench-left)]': showWorkbench,
            'left-[100%]': !showWorkbench,
          },
        )}
      >
        <div className="absolute inset-0 px-2 lg:px-6">
          <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
            <div className="relative flex-1 overflow-hidden">
              <Preview />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});