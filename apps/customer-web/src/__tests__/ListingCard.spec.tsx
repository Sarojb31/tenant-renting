import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import type { Listing } from '../api/listings';

const listing: Listing = {
  id: 'abc123',
  tenantId: 'tenant-1',
  title: 'Cozy single room',
  description: 'Nice place',
  rentAmount: '8000',
  depositAmount: '16000',
  roomType: 'single',
  city: 'Kathmandu',
  address: 'Thamel',
  status: 'published',
  amenities: ['wifi', 'hot water'],
  createdAt: '2024-01-01T00:00:00Z',
};

function renderCard(l = listing) {
  return render(
    <MemoryRouter>
      <ListingCard listing={l} />
    </MemoryRouter>,
  );
}

describe('ListingCard', () => {
  it('renders title', () => {
    renderCard();
    expect(screen.getByText('Cozy single room')).toBeInTheDocument();
  });

  it('renders rent amount', () => {
    renderCard();
    expect(screen.getByText(/8,000/)).toBeInTheDocument();
  });

  it('renders city', () => {
    renderCard();
    expect(screen.getByText(/Kathmandu/)).toBeInTheDocument();
  });

  it('link navigates to listing detail', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/listings/abc123');
  });

  it('shows room type badge', () => {
    renderCard();
    expect(screen.getAllByText(/single/i).length).toBeGreaterThan(0);
  });
});
