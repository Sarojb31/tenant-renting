import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchFilters } from '../components/SearchFilters';

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('SearchFilters', () => {
  it('calls onSearch with form values on submit', async () => {
    const onSearch = vi.fn();
    wrap(<SearchFilters onSearch={onSearch} />);

    const cityInput = screen.getByPlaceholderText(/city/i);
    fireEvent.change(cityInput, { target: { value: 'Pokhara' } });
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Pokhara' }),
        expect.anything(),
      );
    });
  });

  it('renders room type and bhk type selects', () => {
    wrap(<SearchFilters onSearch={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onSearch with empty values when no input given', async () => {
    const onSearch = vi.fn();
    wrap(<SearchFilters onSearch={onSearch} />);
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
  });
});
