import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Layout } from '../../components/Layout';
import {
  fetchSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
  type SmsTemplate,
  type CreateTemplateBody,
} from '../../api/smsTemplates';

const EVENT_LABELS: Record<string, string> = {
  new_match: 'New Match',
  booking_confirmed: 'Booking Confirmed',
  rent_reminder: 'Rent Reminder',
  custom: 'Custom',
};

const PLACEHOLDERS = '{title}, {city}, {rentAmount}, {currency}';

function renderPreview(bodyText: string): string {
  return bodyText
    .replace('{title}', 'Spacious 1BHK')
    .replace('{city}', 'Kathmandu')
    .replace('{rentAmount}', '12,000')
    .replace('{currency}', 'NPR');
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<SmsTemplate>;
  onSave: (data: CreateTemplateBody) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreateTemplateBody>({
    defaultValues: { name: initial?.name, bodyText: initial?.bodyText, eventTrigger: initial?.eventTrigger ?? 'custom' },
  });
  const bodyText = watch('bodyText', '');

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Template Name</label>
          <input
            {...register('name', { required: 'Required' })}
            placeholder="e.g. New Listing Alert"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        {!initial?.id && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Event Trigger</label>
            <select
              {...register('eventTrigger', { required: 'Required' })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="new_match">New Match</option>
              <option value="booking_confirmed">Booking Confirmed</option>
              <option value="rent_reminder">Rent Reminder</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1">
          Body Text <span className="text-gray-400 font-normal">(placeholders: {PLACEHOLDERS})</span>
        </label>
        <textarea
          {...register('bodyText', { required: 'Required', maxLength: { value: 320, message: 'Max 320 chars' } })}
          rows={3}
          placeholder="New room in {city} for {currency} {rentAmount}/mo. View: ..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
        {errors.bodyText && <p className="text-xs text-red-500">{errors.bodyText.message}</p>}
      </div>
      {bodyText && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Preview</p>
          <p className="text-sm text-gray-700">{renderPreview(bodyText)}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-sm bg-brand-600 text-white rounded-lg px-4 py-2 hover:bg-brand-700"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

function TemplateCard({ template, onRefresh }: { template: SmsTemplate; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: (data: CreateTemplateBody) => updateSmsTemplate(template.id, data),
    onSuccess: () => { setEditing(false); onRefresh(); },
  });

  const remove = useMutation({
    mutationFn: () => deleteSmsTemplate(template.id),
    onSuccess: onRefresh,
  });

  return (
    <div className={`border rounded-xl p-4 bg-white ${template.isDefault ? 'border-gray-100 opacity-80' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm">{template.name}</p>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              {EVENT_LABELS[template.eventTrigger] ?? template.eventTrigger}
            </span>
            {template.isDefault && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Platform Default</span>
            )}
          </div>
        </div>
        {!template.isDefault && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit</button>
            <button
              onClick={() => {
                if (confirm('Delete this template?')) remove.mutate();
              }}
              disabled={remove.isPending}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <TemplateForm
          initial={template}
          onSave={(data) => update.mutate(data)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 font-mono">{template.bodyText}</p>
          <p className="text-xs text-gray-400 mt-2">
            Preview: {renderPreview(template.bodyText)}
          </p>
        </>
      )}
    </div>
  );
}

export function SmsTemplatesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: () => fetchSmsTemplates().then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: createSmsTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sms-templates'] });
      setShowCreate(false);
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['sms-templates'] });

  const groups = templates
    ? Object.entries(
        templates.reduce<Record<string, SmsTemplate[]>>((acc, t) => {
          const key = t.eventTrigger;
          if (!acc[key]) acc[key] = [];
          acc[key].push(t);
          return acc;
        }, {}),
      )
    : [];

  return (
    <Layout title="SMS Templates">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between">
          <p className="text-sm text-gray-500">
            Create custom SMS templates that override platform defaults per event. Use placeholders like{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{city}'}</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{rentAmount}'}</code>.
          </p>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm bg-brand-600 text-white rounded-lg px-4 py-2 hover:bg-brand-700 shrink-0 ml-4"
            >
              + New Template
            </button>
          )}
        </div>

        {showCreate && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">New Template</h2>
            <TemplateForm
              onSave={(data) => create.mutate(data)}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse h-24 bg-gray-50" />
            ))}
          </div>
        )}

        {groups.map(([event, group]) => (
          <div key={event}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {EVENT_LABELS[event] ?? event}
            </h2>
            <div className="space-y-3">
              {group.map((t) => (
                <TemplateCard key={t.id} template={t} onRefresh={refresh} />
              ))}
            </div>
          </div>
        ))}

        {!isLoading && templates?.length === 0 && (
          <p className="text-sm text-gray-400">No SMS templates yet. Platform defaults are used.</p>
        )}
      </div>
    </Layout>
  );
}
