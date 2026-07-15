import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchUsers, inviteUser, setUserStatus, type StaffUser, type InviteUserBody } from '../../api/users';

const col = createColumnHelper<StaffUser>();

function InviteForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteUserBody>();

  const invite = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      reset();
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => invite.mutate(data))}
      className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4 max-w-lg"
    >
      <h2 className="font-semibold text-gray-800">Invite Staff / Agent</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Name</label>
          <input
            {...register('name', { required: 'Required' })}
            placeholder="Full name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
          <input
            {...register('email', { required: 'Required', pattern: { value: /^\S+@\S+$/, message: 'Invalid email' } })}
            type="email"
            placeholder="email@company.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Role</label>
          <select
            {...register('role', { required: 'Required' })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">Select role</option>
            <option value="staff">Staff (can create/edit)</option>
            <option value="agent">Agent (read-only)</option>
          </select>
          {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Initial Password</label>
          <input
            {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 chars' } })}
            type="password"
            placeholder="Min 8 characters"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
        </div>
      </div>

      {invite.error && (
        <p className="text-xs text-red-500">
          {(invite.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to invite user'}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={invite.isPending}
          className="text-sm bg-brand-600 text-white rounded-lg px-4 py-2 hover:bg-brand-700 disabled:opacity-50"
        >
          {invite.isPending ? 'Inviting…' : 'Invite User'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers().then((r) => r.data),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'disabled' }) =>
      setUserStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const columns = [
    col.accessor('name', {
      header: 'Name',
      cell: (i) => <span className="font-medium text-gray-900">{i.getValue()}</span>,
    }),
    col.accessor('email', { header: 'Email' }),
    col.accessor('role', {
      header: 'Role',
      cell: (i) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          i.getValue() === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {i.getValue() === 'staff' ? 'Staff' : 'Agent'}
        </span>
      ),
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (i) => <StatusBadge status={i.getValue()} />,
    }),
    col.accessor('lastLoginAt', {
      header: 'Last Login',
      cell: (i) => {
        const v = i.getValue();
        return <span className="text-xs text-gray-400">{v ? new Date(v).toLocaleDateString() : '—'}</span>;
      },
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: (i) => {
        const row = i.row.original;
        return (
          <div className="flex items-center gap-2">
            {row.status !== 'disabled' && (
              <button
                onClick={() => changeStatus.mutate({ id: row.id, status: 'disabled' })}
                disabled={changeStatus.isPending}
                className="text-xs text-red-500 hover:underline disabled:opacity-50"
              >
                Disable
              </button>
            )}
            {row.status === 'disabled' && (
              <button
                onClick={() => changeStatus.mutate({ id: row.id, status: 'active' })}
                disabled={changeStatus.isPending}
                className="text-xs text-green-600 hover:underline disabled:opacity-50"
              >
                Enable
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  return (
    <Layout title="Users">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Manage staff and agent accounts. Agents can view listings and customers but cannot create or edit.
          </p>
          {!showInvite && (
            <button
              onClick={() => setShowInvite(true)}
              className="text-sm bg-brand-600 text-white rounded-lg px-4 py-2 hover:bg-brand-700"
            >
              + Invite User
            </button>
          )}
        </div>

        {showInvite && <InviteForm onDone={() => setShowInvite(false)} />}

        <DataTable
          data={users ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No staff users yet. Invite someone to get started."
        />
      </div>
    </Layout>
  );
}
