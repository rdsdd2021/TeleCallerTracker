export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      call_logs: {
        Row: {
          call_type: string
          called_at: string
          caller_id: string
          contact_name: string | null
          contact_number: string
          created_at: string | null
          device_call_id: string
          duration_sec: number
          id: string
          org_id: string | null
          sim_id: string | null
        }
        Insert: {
          call_type: string
          called_at: string
          caller_id: string
          contact_name?: string | null
          contact_number: string
          created_at?: string | null
          device_call_id: string
          duration_sec: number
          id?: string
          org_id?: string | null
          sim_id?: string | null
        }
        Update: {
          call_type?: string
          called_at?: string
          caller_id?: string
          contact_name?: string | null
          contact_number?: string
          created_at?: string | null
          device_call_id?: string
          duration_sec?: number
          id?: string
          org_id?: string | null
          sim_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "callers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      callers: {
        Row: {
          created_at: string | null
          device_id: string | null
          employee_id: string
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          employee_id: string
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          employee_id?: string
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_configs: {
        Row: {
          connector_type: string
          created_at: string
          credentials_encrypted: Json | null
          id: string
          org_id: string
          status: Database["public"]["Enums"]["connector_status"]
          updated_at: string
        }
        Insert: {
          connector_type: string
          created_at?: string
          credentials_encrypted?: Json | null
          id?: string
          org_id: string
          status?: Database["public"]["Enums"]["connector_status"]
          updated_at?: string
        }
        Update: {
          connector_type?: string
          created_at?: string
          credentials_encrypted?: Json | null
          id?: string
          org_id?: string
          status?: Database["public"]["Enums"]["connector_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      excluded_numbers: {
        Row: {
          created_at: string
          id: string
          org_id: string
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "excluded_numbers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      pinned_call_logs: {
        Row: {
          call_log_id: string
          created_at: string
          id: string
          org_id: string
          pinned_by: string
        }
        Insert: {
          call_log_id: string
          created_at?: string
          id?: string
          org_id: string
          pinned_by: string
        }
        Update: {
          call_log_id?: string
          created_at?: string
          id?: string
          org_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_call_logs_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          app_version: string | null
          caller_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          org_id: string | null
          records_inserted: number
          records_sent: number
          records_updated: number | null
          sync_window_end: string | null
          sync_window_start: string | null
        }
        Insert: {
          app_version?: string | null
          caller_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          records_inserted: number
          records_sent: number
          records_updated?: number | null
          sync_window_end?: string | null
          sync_window_start?: string | null
        }
        Update: {
          app_version?: string | null
          caller_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          records_inserted?: number
          records_sent?: number
          records_updated?: number | null
          sync_window_end?: string | null
          sync_window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "callers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      today_summary: {
        Row: {
          caller_id: string | null
          missed_calls: number | null
          outgoing_calls: number | null
          saved_contacts: number | null
          total_calls: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "callers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_org_with_owner:
        | {
            Args: { p_invite_code: string; p_name: string; p_user_id: string }
            Returns: string
          }
        | { Args: { p_invite_code?: string; p_name: string }; Returns: Json }
      get_agent_daily_trend: {
        Args: { p_caller_id: string; p_days?: number }
        Returns: Json
      }
      get_all_agents_summary: { Args: { p_days?: number }; Returns: Json }
      get_call_trends:
        | {
            Args: { p_caller_id: string; p_days?: number }
            Returns: {
              connected_calls: number
              date: string
              total_calls: number
              total_duration: number
            }[]
          }
        | { Args: { p_caller_id: string; p_days?: number }; Returns: Json }
      get_call_type_distribution: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: Json
      }
      get_contact_interactions:
        | { Args: { p_caller_id: string; p_limit?: number }; Returns: Json }
        | { Args: { p_caller_id: string; p_limit?: number }; Returns: Json }
      get_daily_metrics: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: {
          call_date: string
          connected_calls: number
          incoming_calls: number
          missed_calls: number
          outgoing_calls: number
          total_calls: number
          total_duration: number
        }[]
      }
      get_dashboard_metrics: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: Json
      }
      get_dashboard_stats: { Args: { p_caller_id: string }; Returns: Json }
      get_employee_report: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: {
          avg_duration_sec: number
          caller_id: string
          connected_calls: number
          employee_id: string
          incoming: number
          missed: number
          name: string
          never_attended: number
          not_pickup_by_client: number
          outgoing: number
          rejected: number
          total_calls: number
          total_duration_sec: number
          unique_clients: number
          working_hours_sec: number
        }[]
      }
      get_hourly_metrics: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: {
          avg_duration: number
          calls: number
          hour: string
        }[]
      }
      get_user_org_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { p_org_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      upsert_call_logs: {
        Args: { logs: Json; p_caller_id: string }
        Returns: Json
      }
    }
    Enums: {
      call_type: "incoming" | "outgoing" | "missed" | "rejected" | "spam"
      connector_status: "connected" | "disconnected" | "error"
      org_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      call_type: ["incoming", "outgoing", "missed", "rejected", "spam"],
      connector_status: ["connected", "disconnected", "error"],
      org_role: ["owner", "admin", "member"],
    },
  },
} as const