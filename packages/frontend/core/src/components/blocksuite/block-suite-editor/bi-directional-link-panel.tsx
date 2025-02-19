import {
  Button,
  createReactComponentFromLit,
  useLitPortalFactory,
} from '@affine/component';
import { TextRenderer } from '@affine/core/blocksuite/presets';
import {
  type Backlink,
  DocLinksService,
  type Link,
} from '@affine/core/modules/doc-link';
import { toURLSearchParams } from '@affine/core/modules/navigation';
import { WorkbenchLink } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import type { JobMiddleware } from '@blocksuite/affine/store';
import { ToggleExpandIcon } from '@blocksuite/icons/rc';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  DocService,
  getAFFiNEWorkspaceSchema,
  GlobalSessionStateService,
  LiveData,
  useFramework,
  useLiveData,
  useServices,
  WorkspaceService,
} from '@toeverything/infra';
import React, {
  Fragment,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  AffinePageReference,
  AffineSharedPageReference,
} from '../../affine/reference-link';
import * as styles from './bi-directional-link-panel.css';
import {
  patchReferenceRenderer,
  type ReferenceReactRenderer,
} from './specs/custom/spec-patchers';
import { createPageModeSpecs } from './specs/page';

const BlocksuiteTextRenderer = createReactComponentFromLit({
  react: React,
  elementClass: TextRenderer,
});

const PREFIX = 'bi-directional-link-panel-collapse:';

const useBiDirectionalLinkPanelCollapseState = (
  docId: string,
  linkDocId?: string
) => {
  const { globalSessionStateService } = useServices({
    GlobalSessionStateService,
  });

  const path = linkDocId ? docId + ':' + linkDocId : docId;

  const [open, setOpen] = useState(
    globalSessionStateService.globalSessionState.get(PREFIX + path) ?? false
  );

  const wrappedSetOpen = useCallback(
    (open: boolean) => {
      setOpen(open);
      globalSessionStateService.globalSessionState.set(PREFIX + path, open);
    },
    [path, globalSessionStateService]
  );

  return [open, wrappedSetOpen] as const;
};

const CollapsibleSection = ({
  title,
  children,
  length,
  docId,
  linkDocId,
}: {
  title: ReactNode;
  children: ReactNode;
  length?: number;
  docId: string;
  linkDocId?: string;
}) => {
  const [open, setOpen] = useBiDirectionalLinkPanelCollapseState(
    docId,
    linkDocId
  );
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className={styles.link}>
        {title}
        {length ? (
          <ToggleExpandIcon
            className={styles.collapsedIcon}
            data-collapsed={!open}
          />
        ) : null}
      </Collapsible.Trigger>
      <Collapsible.Content>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
};

const usePreviewExtensions = () => {
  const [reactToLit, portals] = useLitPortalFactory();
  const framework = useFramework();

  const { workspaceService } = useServices({
    WorkspaceService,
  });

  const referenceRenderer: ReferenceReactRenderer = useMemo(() => {
    return function customReference(reference) {
      const data = reference.delta.attributes?.reference;
      if (!data) return <span />;

      const pageId = data.pageId;
      if (!pageId) return <span />;

      const params = toURLSearchParams(data.params);

      if (workspaceService.workspace.openOptions.isSharedMode) {
        return (
          <AffineSharedPageReference
            docCollection={workspaceService.workspace.docCollection}
            pageId={pageId}
            params={params}
          />
        );
      }

      return <AffinePageReference pageId={pageId} params={params} />;
    };
  }, [workspaceService]);

  const extensions = useMemo(() => {
    const specs = createPageModeSpecs(framework);
    return [patchReferenceRenderer(reactToLit, referenceRenderer), ...specs];
  }, [reactToLit, referenceRenderer, framework]);

  return [extensions, portals] as const;
};

export const BiDirectionalLinkPanel = () => {
  const { docLinksService, workspaceService, docService } = useServices({
    DocLinksService,
    WorkspaceService,
    DocService,
  });

  const [extensions, portals] = usePreviewExtensions();
  const t = useI18n();

  const [show, setShow] = useBiDirectionalLinkPanelCollapseState(
    docService.doc.id
  );

  const links = useLiveData(
    show ? docLinksService.links.links$ : new LiveData([] as Link[])
  );
  const backlinkGroups = useLiveData(
    LiveData.computed(get => {
      if (!show) {
        return [];
      }

      const links = get(docLinksService.backlinks.backlinks$);

      // group by docId
      const groupedLinks = links.reduce(
        (acc, link) => {
          acc[link.docId] = [...(acc[link.docId] || []), link];
          return acc;
        },
        {} as Record<string, Backlink[]>
      );

      return Object.entries(groupedLinks).map(([docId, links]) => ({
        docId,
        title: links[0].title, // title should be the same for all blocks
        links,
      }));
    })
  );

  const backlinkCount = useMemo(() => {
    return backlinkGroups.reduce((acc, link) => acc + link.links.length, 0);
  }, [backlinkGroups]);

  const handleClickShow = useCallback(() => {
    setShow(!show);
  }, [show, setShow]);

  const textRendererOptions = useMemo(() => {
    const docLinkBaseURLMiddleware: JobMiddleware = ({ adapterConfigs }) => {
      adapterConfigs.set(
        'docLinkBaseUrl',
        `/workspace/${workspaceService.workspace.id}`
      );
    };

    return {
      customHeading: true,
      extensions,
      additionalMiddlewares: [docLinkBaseURLMiddleware],
    };
  }, [extensions, workspaceService.workspace.id]);

  return (
    <div className={styles.container}>
      {!show && (
        <div className={styles.dividerContainer}>
          <div className={styles.divider}></div>
        </div>
      )}

      <div className={styles.titleLine}>
        <div className={styles.title}>Bi-Directional Links</div>
        <Button className={styles.showButton} onClick={handleClickShow}>
          {show
            ? t['com.affine.editor.bi-directional-link-panel.hide']()
            : t['com.affine.editor.bi-directional-link-panel.show']()}
        </Button>
      </div>

      {show && (
        <>
          <div className={styles.dividerContainer}>
            <div className={styles.divider}></div>
          </div>
          <div className={styles.linksContainer}>
            <div className={styles.linksTitles}>
              {t['com.affine.page-properties.backlinks']()} · {backlinkCount}
            </div>
            {backlinkGroups.map(linkGroup => (
              <CollapsibleSection
                key={linkGroup.docId}
                title={<AffinePageReference pageId={linkGroup.docId} />}
                length={linkGroup.links.length}
                docId={docService.doc.id}
                linkDocId={linkGroup.docId}
              >
                <div className={styles.linkPreviewContainer}>
                  {linkGroup.links.map(link => {
                    if (!link.markdownPreview) {
                      return null;
                    }
                    const searchParams = new URLSearchParams();
                    const displayMode = link.displayMode || 'page';
                    searchParams.set('mode', displayMode);

                    let blockId = link.blockId;
                    if (
                      link.parentFlavour === 'affine:database' &&
                      link.parentBlockId
                    ) {
                      // if parentBlockFlavour is 'affine:database',
                      // we will fallback to the database block instead
                      blockId = link.parentBlockId;
                    } else if (displayMode === 'edgeless' && link.noteBlockId) {
                      // if note has displayMode === 'edgeless' && has noteBlockId,
                      // set noteBlockId as blockId
                      blockId = link.noteBlockId;
                    }

                    searchParams.set('blockIds', blockId);

                    const to = {
                      pathname: '/' + linkGroup.docId,
                      search: '?' + searchParams.toString(),
                      hash: '',
                    };

                    // if this backlink has no noteBlock && displayMode is edgeless, we will render
                    // the link as a page link
                    const edgelessLink =
                      displayMode === 'edgeless' && !link.noteBlockId;

                    return (
                      <WorkbenchLink
                        to={to}
                        key={link.blockId}
                        className={styles.linkPreview}
                      >
                        {edgelessLink ? (
                          <>
                            [Edgeless]
                            <AffinePageReference
                              key={link.blockId}
                              pageId={linkGroup.docId}
                              params={searchParams}
                            />
                          </>
                        ) : (
                          <BlocksuiteTextRenderer
                            className={styles.linkPreviewRenderer}
                            answer={link.markdownPreview}
                            schema={getAFFiNEWorkspaceSchema()}
                            options={textRendererOptions}
                          />
                        )}
                      </WorkbenchLink>
                    );
                  })}
                </div>
              </CollapsibleSection>
            ))}
          </div>
          <div className={styles.linksContainer}>
            <div className={styles.linksTitles}>
              {t['com.affine.page-properties.outgoing-links']()} ·{' '}
              {links.length}
            </div>
            {links.map((link, i) => (
              <div
                key={`${link.docId}-${link.params?.toString()}-${i}`}
                className={styles.link}
              >
                <AffinePageReference pageId={link.docId} params={link.params} />
              </div>
            ))}
          </div>
        </>
      )}
      {
        <>
          {portals.map(p => (
            <Fragment key={p.id}>{p.portal}</Fragment>
          ))}
        </>
      }
    </div>
  );
};
