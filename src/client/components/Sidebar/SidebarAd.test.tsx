import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SidebarAd from './SidebarAd';

vi.mock('../../data/ads', () => ({
  default: [
    {
      id: 1,
      name: 'Test Ad',
      description: 'Try our product today.',
      link: 'https://example.com/ad',
    },
  ],
}));

describe('SidebarAd', () => {
  it('renders ad label and link', () => {
    render(<SidebarAd />);

    expect(screen.getByLabelText('Advertisement')).toBeInTheDocument();
    expect(screen.getByText('Ad')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Try our product today.' });
    expect(link).toHaveAttribute('href', 'https://example.com/ad');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'sponsored noopener noreferrer');
  });
});
