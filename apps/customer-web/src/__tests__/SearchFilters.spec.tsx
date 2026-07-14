import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchFilters } from '../components/SearchFilters';

describe('SearchFilters', () => {
  it('calls onSearch with form values on submit', async () => {
    const onSearch = vi.fn();
    render(<SearchFilters onSearch={onSearch} />);

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

  it('renders room type select', () => {
    render(<SearchFilters onSearch={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onSearch with empty values when no input given', async () => {
    const onSearch = vi.fn();
    render(<SearchFilters onSearch={onSearch} />);
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
  });
});
