import { supabase } from '../lib/supabase';

export interface DashboardStats {
  today: {
    total_calls: number;
    total_duration: number;
    unique_contacts: number;
    incoming: number;
    outgoing: number;
    missed: number;
    rejected: number;
    spam: number;
  };
  yesterday_total: number;
  daily_target: number;
  streak: number;
}

export interface CallTrend {
  day: string;
  incoming: number;
  outgoing: number;
  missed: number;
}

export interface ContactInteraction {
  contact_number: string;
  contact_name: string | null;
  total_calls: number;
  total_duration: number;
  last_call: string;
  incoming_calls: number;
  outgoing_calls: number;
  missed_calls: number;
}

export const statsService = {
  async getDashboardStats(callerId: string): Promise<DashboardStats | null> {
    const { data, error } = await supabase.rpc('get_dashboard_stats_v2', {
      p_caller_id: callerId,
    });
    if (error) {
      console.error('Error fetching dashboard stats:', error);
      return null;
    }
    return data as DashboardStats;
  },

  async getCallTrends(callerId: string, days: number = 7): Promise<CallTrend[]> {
    const { data, error } = await supabase.rpc('get_call_trends', {
      p_caller_id: callerId,
      p_days: days,
    });
    if (error) {
      console.error('Error fetching call trends:', error);
      return [];
    }
    return (data || []) as CallTrend[];
  },

  async getContactInteractions(callerId: string, limit: number = 20): Promise<ContactInteraction[]> {
    const { data, error } = await supabase.rpc('get_contact_interactions', {
      p_caller_id: callerId,
      p_limit: limit,
    });
    if (error) {
      console.error('Error fetching contact interactions:', error);
      return [];
    }
    return (data || []) as ContactInteraction[];
  },
};
