import type { EditorHost } from '@blocksuite/affine/block-std';
import type {
  AffineAIPanelWidgetConfig,
  MindmapStyle,
} from '@blocksuite/affine/blocks';
import {
  markdownToMindmap,
  MiniMindmapPreview,
} from '@blocksuite/affine/blocks';
import { noop } from '@blocksuite/affine/global/utils';
import { html, nothing } from 'lit';

import { getAIPanelWidget } from '../utils/ai-widgets';
import type { AIContext } from '../utils/context';

noop(MiniMindmapPreview);

export const createMindmapRenderer: (
  host: EditorHost,
  /**
   * Used to store data for later use during rendering.
   */
  ctx: AIContext,
  style?: MindmapStyle
) => AffineAIPanelWidgetConfig['answerRenderer'] = (host, ctx, style) => {
  return (answer, state) => {
    if (state === 'generating') {
      const panel = getAIPanelWidget(host);
      panel.generatingElement?.updateLoadingProgress(2);
    }

    if (state !== 'finished' && state !== 'error') {
      return nothing;
    }

    return html`<mini-mindmap-preview
      .ctx=${ctx}
      .host=${host}
      .answer=${answer}
      .mindmapStyle=${style}
      .templateShow=${style === undefined}
      .height=${300}
    ></mini-mindmap-preview>`;
  };
};

/**
 * Creates a renderer for executing a handler.
 * The ai panel will not display anything after the answer is generated.
 */
export const createMindmapExecuteRenderer: (
  host: EditorHost,
  /**
   * Used to store data for later use during rendering.
   */
  ctx: AIContext,
  handler: (host: EditorHost, ctx: AIContext) => void
) => AffineAIPanelWidgetConfig['answerRenderer'] = (host, ctx, handler) => {
  return (answer, state) => {
    if (state !== 'finished') {
      const panel = getAIPanelWidget(host);
      panel.generatingElement?.updateLoadingProgress(2);
      return nothing;
    }

    ctx.set({
      node: markdownToMindmap(answer, host.doc),
    });

    handler(host, ctx);

    return nothing;
  };
};
