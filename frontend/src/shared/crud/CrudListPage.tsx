import type { ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { motion } from 'framer-motion'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

export interface CrudListPageProps<T extends { id: string }> {
  title: string
  subtitle?: string
  columns: GridColDef<T>[]
  rows: T[]
  rowCount: number
  loading: boolean
  paginationModel: GridPaginationModel
  onPaginationModelChange: (model: GridPaginationModel) => void
  pageSizeOptions?: number[]
  onAdd?: () => void
  addLabel?: string
  onView?: (row: T) => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  extraToolbar?: ReactNode
  hideActions?: boolean
  /** Rows matching this predicate get a highlighted (light red) background — e.g. flagging expired students. */
  highlightRowIf?: (row: T) => boolean
  /** Opt-in phone card layout. When set, viewports <600px render this instead of the DataGrid; all other pages keep the grid unchanged. */
  renderMobileCard?: (row: T) => ReactNode
  /** Opt-in: on phone-sized viewports, moves the Add button out of the header and next to extraToolbar so they sit side by side. Other pages are unaffected unless they set this. */
  mobileInlineActions?: boolean
}

export function CrudListPage<T extends { id: string }>({
  title,
  subtitle,
  columns,
  rows,
  rowCount,
  loading,
  paginationModel,
  onPaginationModelChange,
  pageSizeOptions = [10, 20, 50],
  onAdd,
  addLabel = 'Add new',
  onView,
  onEdit,
  onDelete,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  extraToolbar,
  hideActions = false,
  highlightRowIf,
  renderMobileCard,
  mobileInlineActions = false,
}: CrudListPageProps<T>) {
  const isMobile = useIsMobile()
  const addButtonInHeader = !(isMobile && mobileInlineActions)
  const actionColumn: GridColDef<T>[] =
    hideActions || (!onView && !onEdit && !onDelete)
      ? []
      : [
          {
            field: '__actions',
            headerName: 'Actions',
            sortable: false,
            filterable: false,
            width: 110 + (onView ? 40 : 0),
            renderCell: (params) => (
              <Stack direction="row" spacing={0.5}>
                {onView && (
                  <Tooltip title="View">
                    <IconButton size="small" onClick={() => onView(params.row)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {onEdit && (
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEdit(params.row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {onDelete && (
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDelete(params.row)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ),
          },
        ]

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      sx={{ p: { xs: 2, md: 3 } }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {onAdd && addButtonInHeader && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>
            {addLabel}
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        {onSearchChange && (
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
        {onAdd && !addButtonInHeader ? (
          <Stack direction="row" spacing={1.5} sx={{ width: '100%', flexWrap: 'wrap' }} alignItems="center">
            <Tooltip title={addLabel}>
              <IconButton
                onClick={onAdd}
                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            {extraToolbar}
          </Stack>
        ) : (
          extraToolbar
        )}
      </Stack>

      {isMobile && renderMobileCard ? (
        <Stack spacing={1.5} sx={{ pb: 'max(16px, env(safe-area-inset-bottom))' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={28} />
            </Box>
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 5 }}>
              No records found
            </Typography>
          ) : (
            rows.map((row) => <Box key={row.id}>{renderMobileCard(row)}</Box>)
          )}

          {rowCount > paginationModel.pageSize && (
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Page {paginationModel.page + 1} of {Math.max(1, Math.ceil(rowCount / paginationModel.pageSize))}
              </Typography>
              <Stack direction="row" spacing={1}>
                <IconButton
                  size="small"
                  disabled={paginationModel.page === 0}
                  onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page - 1 })}
                >
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={(paginationModel.page + 1) * paginationModel.pageSize >= rowCount}
                  onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page + 1 })}
                >
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          )}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <DataGrid
            rows={rows}
            columns={[...columns, ...actionColumn]}
            rowCount={rowCount}
            loading={loading}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            pageSizeOptions={pageSizeOptions}
            disableRowSelectionOnClick
            autoHeight
            getRowClassName={(params) => (highlightRowIf?.(params.row) ? 'row-highlight' : '')}
            sx={{
              border: 'none',
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'action.hover' },
              '& .row-highlight': {
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.18) },
              },
            }}
          />
        </Paper>
      )}
    </Box>
  )
}
