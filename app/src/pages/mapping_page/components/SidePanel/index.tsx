import AIPanel from '@/pages/mapping_page/components/SidePanel/components/AIPanel';
import ProblemsPanel from '@/pages/mapping_page/components/SidePanel/components/ProblemsPanel';
import SearchPanel from '@/pages/mapping_page/components/SidePanel/components/SearchPanel';
import SourcePanel from '@/pages/mapping_page/components/SidePanel/components/SourcePanel';
import useMappingPage from '@/pages/mapping_page/state';
import { Card } from '@blueprintjs/core';
import NodeProperties from './components/NodeProperties';

const SidePanel = () => {
  const selectedTab = useMappingPage(state => state.selectedTab);
  const panelContent = () => {
    switch (selectedTab) {
      case 'properties':
        return <NodeProperties />;
      case 'ai':
        return <AIPanel />;
      case 'references':
        return <SourcePanel />;
      case 'search':
        return <SearchPanel />;
      case 'problems':
        return <ProblemsPanel />;
      default:
        return <NodeProperties />;
    }
  };

  return (
    <div className='side-panel' style={{ height: '100%' }}>
      <Card
        style={{
          height: '100%',
          overflowY: 'auto',
          position: 'relative',
          // closer to bp5 dark theme
          background: '#182026',
          padding: '10px',
        }}
      >
        {panelContent()}
      </Card>
    </div>
  );
};

export default SidePanel;
