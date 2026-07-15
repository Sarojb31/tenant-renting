import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatCard } from '../../components/StatCard';
import { fetchTenantAnalytics } from '../../api/analytics';

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => fetchTenantAnalytics().then((r) => r.data),
  });

  return (
    <Layout title="Analytics">
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Listings */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Listings</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total"     value={data.listings.total}     sub="All statuses"  accent="blue" />
              <StatCard label="Published" value={data.listings.published} sub="Live on site"  accent="green" live />
              <StatCard label="Draft"     value={data.listings.draft}     sub="Not live"      accent="amber" />
              <StatCard label="Archived"  value={data.listings.archived}  sub="Removed"       accent="red" />
            </div>
          </div>

          {/* Customers + Bookings */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Customers & Bookings</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Customers"         value={data.customers.total}    sub="Registered"      accent="blue" />
              <StatCard label="Bookings (total)"  value={data.bookings.total}     sub="All time"        accent="green" />
              <StatCard label="Pending Bookings"  value={data.bookings.pending}   sub="Awaiting action" accent="amber" />
            </div>
          </div>

          {/* Revenue */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StatCard
                label="Total Revenue"
                value={`${data.revenue.currency} ${Number(data.revenue.total).toLocaleString()}`}
                sub="Confirmed payments"
                accent="green"
              />
            </div>
          </div>

          {/* SMS */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">SMS</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Sent"            value={data.sms.sent}             sub="Delivered to gateway"  accent="blue" />
              <StatCard label="Failed"          value={data.sms.failed}           sub="Send errors"           accent="red" />
              <StatCard label="Credits Remaining" value={data.sms.creditsRemaining} sub="Current period"     accent="amber" />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
