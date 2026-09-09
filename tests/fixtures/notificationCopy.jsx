// Local-only visual/interaction fixture. Does not read or write a live account.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NotificationCopyEditor } from '../../src/pages/leadership/NotificationSettings';
import '../../src/index.css';

function Fixture() {
  const [rule, setRule] = useState({
    id: 'fixture', type: 'featured_event_created', label: 'Featured event scheduled', category: 'events',
    description: 'Fixture only', target_roles: ['Members'], template_title: null, template_body: null,
    event_type_templates: {},
  });
  return <main style={{ minHeight: '100vh', background: '#09090b', padding: 16, color: 'white' }}>
    <div className="space-y-4" style={{ margin: '0 auto', maxWidth: 512 }}>
      <h1>Notification wording QA — isolated fixture</h1>
      <NotificationCopyEditor rule={rule} eventTypes={['Revamp Session', 'Youth Recharge', 'Sunday Service']}
        organizationName="Demo Church" patchRule={(_id, patch) => setRule(current => ({ ...current, ...patch }))}
        testing={false} onTest={() => { throw new Error('Sending is disabled in this fixture'); }} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
