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
      activity_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          event: string
          id: string
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      bots: {
        Row: {
          code: string
          deployed_at: string
          disconnected_at: string | null
          id: string
          last_active: string
          phone_number: string
          status: string
          user_id: string
        }
        Insert: {
          code: string
          deployed_at?: string
          disconnected_at?: string | null
          id?: string
          last_active?: string
          phone_number: string
          status?: string
          user_id: string
        }
        Update: {
          code?: string
          deployed_at?: string
          disconnected_at?: string | null
          id?: string
          last_active?: string
          phone_number?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      child_projects: {
        Row: {
          continuation_duration_unit: string
          continuation_duration_value: number
          continuation_price_coins: number
          created_at: string
          description: string | null
          enabled: boolean
          free_trial_seconds: number
          icon: string | null
          id: string
          name: string
          price_coins: number
          service_key: string | null
          slug: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          continuation_duration_unit?: string
          continuation_duration_value?: number
          continuation_price_coins?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          free_trial_seconds?: number
          icon?: string | null
          id?: string
          name: string
          price_coins?: number
          service_key?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          continuation_duration_unit?: string
          continuation_duration_value?: number
          continuation_price_coins?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          free_trial_seconds?: number
          icon?: string | null
          id?: string
          name?: string
          price_coins?: number
          service_key?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          recipient_id: string | null
          sender_label: string
          title: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_id?: string | null
          sender_label?: string
          title?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_id?: string | null
          sender_label?: string
          title?: string | null
        }
        Relationships: []
      }
      mpesa_transactions: {
        Row: {
          amount: number
          checkout_request_id: string | null
          client_id: string
          coins_credited: boolean
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          result_desc: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          client_id: string
          coins_credited?: boolean
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone: string
          result_desc?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          client_id?: string
          coins_credited?: boolean
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone?: string
          result_desc?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pairing_logs: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          phone_number: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          phone_number: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          phone_number?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      password_reset_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          banned: boolean
          banned_at: string | null
          bots_deployed: number
          coins: number
          created_at: string
          email: string | null
          games_played: number
          id: string
          last_active: string
          phone: string
          referral_code: string
          referred_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banned?: boolean
          banned_at?: string | null
          bots_deployed?: number
          coins?: number
          created_at?: string
          email?: string | null
          games_played?: number
          id?: string
          last_active?: string
          phone: string
          referral_code: string
          referred_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banned?: boolean
          banned_at?: string | null
          bots_deployed?: number
          coins?: number
          created_at?: string
          email?: string | null
          games_played?: number
          id?: string
          last_active?: string
          phone?: string
          referral_code?: string
          referred_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_pricing: {
        Row: {
          continuation_price_coins: number
          created_at: string
          enabled: boolean
          id: string
          name: string
          price_coins: number
          service_key: string
          updated_at: string
        }
        Insert: {
          continuation_price_coins?: number
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          price_coins?: number
          service_key: string
          updated_at?: string
        }
        Update: {
          continuation_price_coins?: number
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          price_coins?: number
          service_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_usage: {
        Row: {
          created_at: string
          free_trial_expired: boolean
          id: string
          paid_continuation: boolean
          service_key: string
          updated_at: string
          usage_start_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_trial_expired?: boolean
          id?: string
          paid_continuation?: boolean
          service_key: string
          updated_at?: string
          usage_start_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_trial_expired?: boolean
          id?: string
          paid_continuation?: boolean
          service_key?: string
          updated_at?: string
          usage_start_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      transfer_tokens: {
        Row: {
          child_slug: string
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          child_slug: string
          consumed?: boolean
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          child_slug?: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
