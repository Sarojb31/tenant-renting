import { render, screen } from '@testing-library/react';
import { StatCard } from '../components/StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Active Listings" value={42} />);
    expect(screen.getByText('Active Listings')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders sub text when provided', () => {
    render(<StatCard label="Revenue" value="₹10,000" sub="Confirmed payments" />);
    expect(screen.getByText('Confirmed payments')).toBeInTheDocument();
  });

  it('shows live indicator when live=true', () => {
    render(<StatCard label="Tenants" value={5} live />);
    expect(screen.getByText('live')).toBeInTheDocument();
  });

  it('does not show live indicator when live=false', () => {
    render(<StatCard label="Tenants" value={5} />);
    expect(screen.queryByText('live')).not.toBeInTheDocument();
  });
});
