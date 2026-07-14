import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['published', 'Published'],
    ['pending',   'Pending'],
    ['success',   'Success'],
    ['failed',    'Failed'],
    ['draft',     'Draft'],
    ['suspended', 'Suspended'],
    ['refunded',  'Refunded'],
    ['trial',     'Trial'],
  ])('renders %s badge with label %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('handles unknown status gracefully', () => {
    render(<StatusBadge status="unknown_state" />);
    expect(screen.getByText('unknown_state')).toBeInTheDocument();
  });
});
