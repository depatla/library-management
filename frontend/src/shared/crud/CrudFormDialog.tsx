import { type ReactNode } from 'react'
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Controller, useForm, useWatch, type DefaultValues, type FieldValues, type Resolver, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'

export type CrudFieldType = 'text' | 'number' | 'decimal' | 'date' | 'select' | 'autocomplete' | 'boolean' | 'textarea' | 'display'

export interface CrudFieldOption {
  value: string
  label: string
}

export interface CrudField {
  name: string
  label: string
  type: CrudFieldType
  options?: CrudFieldOption[]
  required?: boolean
  helperText?: string
  gridSpan?: 1 | 2
  /** Hide this field unless the predicate (given current form values) returns true. */
  visible?: (values: Record<string, unknown>) => boolean
  /** For type "display" only — derives a read-only value from the current form values. */
  compute?: (values: Record<string, unknown>) => string
  /** For type "autocomplete" only — called as the user types, so the caller can refetch `options` (e.g. server-side search). */
  onSearchChange?: (value: string) => void
}

interface CrudFormDialogProps<T extends FieldValues> {
  open: boolean
  title: string
  fields: CrudField[]
  schema: ZodType<T>
  defaultValues: DefaultValues<T>
  onClose: () => void
  onSubmit: (values: T) => Promise<void> | void
  submitLabel?: string
  isSubmitting?: boolean
  serverError?: string | null
  extra?: ReactNode
}

export function CrudFormDialog<T extends FieldValues>({
  open,
  title,
  fields,
  schema,
  defaultValues,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  isSubmitting = false,
  serverError,
  extra,
}: CrudFormDialogProps<T>) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    defaultValues,
    values: defaultValues as unknown as T,
  })

  const watchedValues = useWatch({ control }) as Record<string, unknown>

  function handleClose() {
    reset(defaultValues)
    onClose()
  }

  async function submit(values: T) {
    await onSubmit(values)
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(submit as SubmitHandler<T>)}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            {fields
              .filter((field) => !field.visible || field.visible(watchedValues))
              .map((field) => (
              <Controller
                key={field.name}
                name={field.name as never}
                control={control}
                render={({ field: rhf }) => {
                  const errorMessage = (errors as Record<string, { message?: string } | undefined>)[field.name]?.message

                  if (field.type === 'display') {
                    return (
                      <TextField
                        value={field.compute ? field.compute(watchedValues) : ''}
                        label={field.label}
                        helperText={field.helperText}
                        fullWidth
                        disabled
                      />
                    )
                  }

                  if (field.type === 'boolean') {
                    return (
                      <FormControlLabel
                        control={<Switch checked={Boolean(rhf.value)} onChange={(e) => rhf.onChange(e.target.checked)} />}
                        label={field.label}
                      />
                    )
                  }

                  if (field.type === 'autocomplete') {
                    const options = field.options ?? []
                    const selected = options.find((opt) => opt.value === rhf.value) ?? null
                    return (
                      <Autocomplete
                        options={options}
                        value={selected}
                        getOptionLabel={(opt) => opt.label}
                        isOptionEqualToValue={(opt, val) => opt.value === val.value}
                        onChange={(_e, newValue) => rhf.onChange(newValue?.value ?? '')}
                        onInputChange={(_e, newInputValue, reason) => {
                          if (reason === 'input') field.onSearchChange?.(newInputValue)
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={field.label}
                            required={field.required}
                            error={Boolean(errorMessage)}
                            helperText={errorMessage ?? field.helperText}
                          />
                        )}
                      />
                    )
                  }

                  if (field.type === 'select') {
                    return (
                      <TextField
                        {...rhf}
                        value={rhf.value ?? ''}
                        select
                        label={field.label}
                        required={field.required}
                        error={Boolean(errorMessage)}
                        helperText={errorMessage ?? field.helperText}
                        fullWidth
                      >
                        {(field.options ?? []).map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )
                  }

                  return (
                    <TextField
                      {...rhf}
                      value={rhf.value ?? ''}
                      label={field.label}
                      required={field.required}
                      type={field.type === 'number' || field.type === 'decimal' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      multiline={field.type === 'textarea'}
                      minRows={field.type === 'textarea' ? 3 : undefined}
                      slotProps={field.type === 'date' ? { inputLabel: { shrink: true } } : undefined}
                      error={Boolean(errorMessage)}
                      helperText={errorMessage ?? field.helperText}
                      fullWidth
                      onChange={(e) => {
                        if (field.type === 'number' || field.type === 'decimal') {
                          rhf.onChange(e.target.value === '' ? '' : Number(e.target.value))
                        } else {
                          rhf.onChange(e.target.value)
                        }
                      }}
                    />
                  )
                }}
              />
            ))}
            {extra}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
