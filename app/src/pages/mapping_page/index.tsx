import toast from '@/consts/toast';
import MappingDialog from '@/pages/mapping_page/components/MappingDialog';
import useAIPanel from '@/pages/mapping_page/components/SidePanel/components/AIPanel/state';
import { ReactFlowProvider } from '@xyflow/react';
import { languages } from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { useParams } from 'react-router-dom';
import useRegisterCompletionItemProvider from '../../components/OneLineMonacoEditor/hooks/useRegisterCompletionItemProvider';
import useRegisterLanguage from '../../components/OneLineMonacoEditor/hooks/useRegisterLanguage';
import useRegisterTheme from '../../components/OneLineMonacoEditor/hooks/useRegisterTheme';
import { mapping_language } from '../../consts/mapping-language';
import mapping_theme from '../../consts/mapping-theme';
import useErrorToast from '../../hooks/useErrorToast';
import MainPanel from './components/MainPanel';
import Navbar from './components/Navbar';
import SidePanel from './components/SidePanel';
import VerticalTabs from './components/VerticalTabs';
import useMappingPage from './state';
import './styles.scss';

type MappingPageURLProps = {
  uuid: string;
  mapping_uuid: string;
};

const MappingPage = () => {
  const props = useParams<MappingPageURLProps>();
  const selectedTab = useMappingPage(state => state.selectedTab);
  const isCollapsed = useMappingPage(state => state.isSidePanelCollapsed);
  const mapping = useMappingPage(state => state.mapping);
  const source = useMappingPage(state => state.source);
  const prefixes = useMappingPage(state => state.prefixes);
  const isLoading = useMappingPage(state => state.isLoading);
  const error = useMappingPage(state => state.error);
  const isSaved = useMappingPage(state => state.isSaved);
  const loadMapping = useMappingPage(state => state.loadMapping);
  const setSelectedTab = useMappingPage(state => state.setSelectedTab);
  const setIsCollapsed = useMappingPage(state => state.setIsSidePanelCollapsed);
  const completeMapping = useMappingPage(state => state.completeMapping);
  const clearAIState = useAIPanel(state => state.clear);

  const [openDialog, setOpenDialog] = useState<'complete_mapping' | null>(null);
  useRegisterTheme('mapping-theme', mapping_theme);
  useRegisterLanguage('mapping_language', mapping_language, {});
  useRegisterCompletionItemProvider('mapping_language', [
    {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      provideCompletionItems(model, position, context, token) {
        const word = model.getWordUntilPosition(position);

        const range = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };
        return {
          suggestions: [
            ...(prefixes?.map(prefix => ({
              label: prefix.prefix,
              kind: languages.CompletionItemKind.Variable,
              detail: 'Prefix',
              insertText: prefix.prefix + ':',
              range,
            })) ?? []),
            ...(source?.references
              ? source.references.map(ref => ({
                  label: ref,
                  kind: languages.CompletionItemKind.Class,
                  detail: 'Reference',
                  insertText: '$(' + ref + ')',
                  range,
                }))
              : []),
          ],
        } as languages.CompletionList;
      },
    },
  ]);

  const sidePanelHandle = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    return () => {
      clearAIState();
    };
  }, [clearAIState]);

  useEffect(() => {
    if (sidePanelHandle.current) {
      if (isCollapsed) {
        sidePanelHandle.current.collapse();
      } else {
        sidePanelHandle.current.expand();
      }
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (props.uuid && props.mapping_uuid) {
      loadMapping(props.uuid, props.mapping_uuid);
    }
  }, [props.uuid, props.mapping_uuid, loadMapping]);

  useErrorToast(error);

  const handleTabClick = (tabId: string) => {
    if (selectedTab === tabId && !isCollapsed) {
      setIsCollapsed(true);
      return;
    }
    setSelectedTab(tabId as 'properties' | 'ai' | 'references' | 'search');
    setIsCollapsed(false);
  };

  const [completeMappingResult, setCompleteMappingResult] = useState<{
    yarrrml: string;
    rml: string;
    ttl: string;
  } | null>(null);

  const onCompleteMapping = async () => {
    if (!props.uuid || !props.mapping_uuid) return;
    if (!isSaved) {
      toast.show({
        message: 'Please save the mapping before completing it',
        intent: 'warning',
      });
      return;
    }
    const { yarrrml, rml, ttl } = await completeMapping(
      props.uuid,
      props.mapping_uuid,
    );
    setCompleteMappingResult({ yarrrml, rml, ttl });
    setOpenDialog('complete_mapping');
  };

  return (
    <ReactFlowProvider>
      <div className='mapping-page'>
        <MappingDialog
          open={openDialog === 'complete_mapping'}
          yarrrml={completeMappingResult?.yarrrml ?? ''}
          rml={completeMappingResult?.rml ?? ''}
          ttl={completeMappingResult?.ttl ?? ''}
          onClose={() => setOpenDialog(null)}
        />
        <Navbar
          workspace_uuid={props.uuid}
          mapping_uuid={props.mapping_uuid}
          name={mapping?.name}
          isLoading={isLoading}
          onCompleteMapping={onCompleteMapping}
        />
        <div className='mapping-page-content'>
          <PanelGroup direction='horizontal' style={{ height: '100%' }}>
            <VerticalTabs
              selectedTab={selectedTab}
              isCollapsed={isCollapsed}
              handleTabClick={handleTabClick}
            />
            <Panel
              ref={sidePanelHandle}
              collapsible
              collapsedSize={0}
              onCollapse={() => setIsCollapsed(true)}
              defaultSize={20}
              minSize={10}
              maxSize={50}
            >
              <SidePanel />
            </Panel>
            {!isCollapsed && (
              <PanelResizeHandle className='resize-handle'></PanelResizeHandle>
            )}
            <Panel>
              <MainPanel initialGraph={mapping} />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default MappingPage;
