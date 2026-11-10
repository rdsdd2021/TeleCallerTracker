import { createClient } from '@/lib/supabase/server'

export interface EmployeeRow {
  id: string
  name: string
  employeeId: string
  deviceId: string | null
  registrationDate: string
  lastSync: string | null
}

export async function getEmployees(orgId: string): Promise<EmployeeRow[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('callers')
    .select(`
      id,
      name,
      employee_id,
      device_id,
      created_at,
      sync_logs (
        created_at
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    const syncDates = (row.sync_logs as { created_at: string | null }[] | null) ?? []
    const lastSync =
      syncDates.length > 0
        ? syncDates.reduce((latest, s) => {
            if (!s.created_at) return latest
            if (!latest) return s.created_at
            return s.created_at > latest ? s.created_at : latest
          }, null as string | null)
        : null

    return {
      id: row.id,
      name: row.name,
      employeeId: row.employee_id,
      deviceId: row.device_id ?? null,
      registrationDate: row.created_at ?? '',
      lastSync,
    }
  })
}

export async function insertEmployee(
  orgId: string,
  name: string,
  employeeId: string
): Promise<{ error?: string }> {
  const supabase = createClient()

  const { error } = await supabase.from('callers').insert({
    name,
    employee_id: employeeId,
    org_id: orgId,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'An employee with this ID already exists in your organisation.' }
    }
    return { error: error.message }
  }

  return {}
}
