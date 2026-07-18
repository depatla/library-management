import { type ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Box,
  Button,
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
import { motion } from 'framer-motion'

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
}: CrudListPageProps<T>) {
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
        {onAdd && (
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
        {extraToolbar}
      </Stack>

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
    </Box>
  )
}
