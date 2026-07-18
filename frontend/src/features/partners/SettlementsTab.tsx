import { useState } from 'react'
import { z } from 'zod'
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { useListPartnersQuery, useListSettlementsQuery, useGenerateSettlementsMutation, useRecordReceiptMutation, type Settlement } from './partnersApi'

const receiptSchema = z.object({ amount: z.number().positive('Must be greater than 0') })
type ReceiptForm = z.infer<typeof receiptSchema>
const receiptFields: CrudField[] = [{ name: 'amount', label: 'Amount received (₹)', type: 'decimal', required: true }]

export function SettlementsTab({ libraryId }: { libraryId: string }) {
  const { data: partnersPage } = useListPartnersQuery({ libraryId, page: 1, pageSize: 100 })
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [periodMonth, setPeriodMonth] = useState('')
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const [recording, setRecording] = useState<Settlement | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [generateSettlements, { isLoading: isGenerating }] = useGenerateSettlementsMutation()
  const [recordReceipt, { isLoading: isRecording }] = useRecordReceiptMutation()

  const { data, isLoading } = useListSettlementsQuery(
    { libraryId, partnerId: selectedPartnerId, page: paginationModel.page + 1, pageSize: paginationModel.pageSize },
    { skip: !selectedPartnerId },
  )

  const columns: GridColDef<Settlement>[] = [
    { field: 'period_month', headerName: 'Period', width: 120 },
    { field: 'share_amount', headerName: 'Share amount', width: 130, valueFormatter: (v: number) => `₹${v}` },
    { field: 'received_amount', headerName: 'Received', width: 120, valueFormatter: (v: number) => `₹${v}` },
    { field: 'balance', headerName: 'Balance', width: 120, valueFormatter: (v: number) => `₹${v}` },
    {
      field: 'settled_at',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => <Chip size="small" label={params.value ? 'Settled' : 'Pending'} color={params.value ? 'success' : 'warning'} />,
    },
  ]

  async function handleGenerate() {
    if (!periodMonth) return
    try {
      await generateSettlements({ libraryId, periodMonth: `${periodMonth}-01` }).unwrap()
      notify('Settlements generated')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    }
  }

  async function handleRecordReceipt(values: ReceiptForm) {
    if (!recording) return
    try {
      await recordReceipt({ libraryId, settlementId: recording.id, amount: values.amount }).unwrap()
      notify('Receipt recorded')
      setRecording(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Partner"
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {(partnersPage?.items ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="month"
            label="Generate for month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="contained" onClick={handleGenerate} disabled={!periodMonth || isGenerating}>
            Generate settlements
          </Button>
        </Stack>

        {!selectedPartnerId ? (
          <Typography color="text.secondary">Select a partner to view settlements.</Typography>
        ) : (
          <CrudListPage
            title="Settlements"
            columns={columns}
            rows={data?.items ?? []}
            rowCount={data?.total ?? 0}
            loading={isLoading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            onEdit={(row) => {
              setServerError(null)
              setRecording(row)
            }}
          />
        )}
      </Box>

      <CrudFormDialog<ReceiptForm>
        open={Boolean(recording)}
        title="Record receipt"
        fields={receiptFields}
        schema={receiptSchema}
        defaultValues={{ amount: 0 }}
        onClose={() => setRecording(null)}
        onSubmit={handleRecordReceipt}
        isSubmitting={isRecording}
        serverError={serverError}
        submitLabel="Record"
      />

      {SnackbarElement}
    </>
  )
}
