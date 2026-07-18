import { useParams } from 'react-router-dom'
import { Box, Grid, LinearProgress, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import {
  useGetRevenueExpenseReportQuery,
  useGetOccupancyReportQuery,
  useGetStudentsSummaryReportQuery,
  useGetContributionsReportQuery,
} from './reportsApi'

function formatMonth(monthStr: string) {
  return new Date(monthStr).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export function ReportsPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const theme = useTheme()
  const { data: revenueExpense, isLoading: loadingRevenue } = useGetRevenueExpenseReportQuery({ libraryId: libraryId!, months: 6 })
  const { data: occupancy, isLoading: loadingOccupancy } = useGetOccupancyReportQuery(libraryId!)
  const { data: studentsSummary, isLoading: loadingStudents } = useGetStudentsSummaryReportQuery({ libraryId: libraryId!, months: 6 })
  const { data: contributions, isLoading: loadingContributions } = useGetContributionsReportQuery({ libraryId: libraryId!, months: 6 })

  const latestMonth = contributions?.series.length ? contributions.series[contributions.series.length - 1].month : null
  const currentContributions = (contributions?.series ?? []).filter((c) => c.month === latestMonth)

  const revenueChartData =
    revenueExpense?.series.map((m) => ({ month: formatMonth(m.month), Revenue: Number(m.revenue), Expenses: Number(m.expenses) })) ?? []

  const studentsLineData = [
    {
      id: 'New',
      data: (studentsSummary?.series ?? []).map((m) => ({ x: formatMonth(m.month), y: m.new_count })),
    },
    {
      id: 'Active',
      data: (studentsSummary?.series ?? []).map((m) => ({ x: formatMonth(m.month), y: m.active_count })),
    },
    {
      id: 'Expired',
      data: (studentsSummary?.series ?? []).map((m) => ({ x: formatMonth(m.month), y: m.expired_count })),
    },
  ]

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Revenue, expenses, occupancy, and student trends
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: 360 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Revenue vs Expenses
            </Typography>
            {loadingRevenue ? (
              <Skeleton variant="rounded" height={280} />
            ) : (
              <Box sx={{ height: 280 }}>
                <ResponsiveBar
                  data={revenueChartData}
                  keys={['Revenue', 'Expenses']}
                  indexBy="month"
                  groupMode="grouped"
                  margin={{ top: 10, right: 10, bottom: 40, left: 60 }}
                  padding={0.3}
                  colors={[theme.palette.primary.main, theme.palette.warning.main]}
                  borderRadius={4}
                  axisBottom={{ tickSize: 0, tickPadding: 8 }}
                  axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => `₹${Number(v) / 1000}k` }}
                  enableLabel={false}
                  theme={{
                    text: { fill: theme.palette.text.secondary, fontSize: 12 },
                    grid: { line: { stroke: theme.palette.divider } },
                  }}
                  animate
                />
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: 360 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Students trend
            </Typography>
            {loadingStudents ? (
              <Skeleton variant="rounded" height={280} />
            ) : (
              <Box sx={{ height: 280 }}>
                <ResponsiveLine
                  data={studentsLineData}
                  margin={{ top: 10, right: 20, bottom: 40, left: 40 }}
                  colors={[theme.palette.primary.main, theme.palette.success.main, theme.palette.error.main]}
                  axisBottom={{ tickSize: 0, tickPadding: 8 }}
                  axisLeft={{ tickSize: 0, tickPadding: 8 }}
                  pointSize={8}
                  useMesh
                  theme={{
                    text: { fill: theme.palette.text.secondary, fontSize: 12 },
                    grid: { line: { stroke: theme.palette.divider } },
                  }}
                  legends={[
                    {
                      anchor: 'top-right',
                      direction: 'row',
                      translateY: -10,
                      itemWidth: 70,
                      itemHeight: 20,
                      symbolSize: 10,
                      symbolShape: 'circle',
                    },
                  ]}
                />
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid size={12}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Occupancy by category
            </Typography>
            {loadingOccupancy || !occupancy ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <Stack spacing={2}>
                {occupancy.categories.map((c) => (
                  <Box key={c.room_category_id}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{c.room_category_name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {c.occupied_cabins} / {c.total_cabins}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={c.total_cabins ? (c.occupied_cabins / c.total_cabins) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                ))}
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="body2">Lockers</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {occupancy.occupied_lockers} / {occupancy.total_lockers}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={occupancy.total_lockers ? (occupancy.occupied_lockers / occupancy.total_lockers) * 100 : 0}
                    color="secondary"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid size={12}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Individual contributions {latestMonth ? `— ${formatMonth(latestMonth)}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              How much each person (staff or partner) personally collected and spent this month
            </Typography>
            {loadingContributions ? (
              <Skeleton variant="rounded" height={120} />
            ) : currentContributions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No activity recorded this month.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Person</TableCell>
                    <TableCell align="right">Collected</TableCell>
                    <TableCell align="right">Spent</TableCell>
                    <TableCell align="right">Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentContributions.map((c) => (
                    <TableRow key={c.user_id}>
                      <TableCell>{c.full_name}</TableCell>
                      <TableCell align="right">₹{Number(c.collected_amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">₹{Number(c.spent_amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">₹{(Number(c.collected_amount) - Number(c.spent_amount)).toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
