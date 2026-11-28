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
    PostgrestVersion: "14.18"
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
      admin_access_sessions: {
        Row: {
          expires_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          expires_at: string
          session_id: string
          user_id: string
        }
        Update: {
          expires_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_profit_withdrawals: {
        Row: {
          amount: number
          conversation_id: string | null
          created_at: string
          created_by: string
          id: string
          mpesa_receipt: string | null
          originator_conversation_id: string | null
          phone: string
          processed_at: string | null
          result_desc: string | null
          status: string
        }
        Insert: {
          amount: number
          conversation_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          mpesa_receipt?: string | null
          originator_conversation_id?: string | null
          phone: string
          processed_at?: string | null
          result_desc?: string | null
          status?: string
        }
        Update: {
          amount?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mpesa_receipt?: string | null
          originator_conversation_id?: string | null
          phone?: string
          processed_at?: string | null
          result_desc?: string | null
          status?: string
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
      balance_resets: {
        Row: {
          id: string
          previous_coins: number
          reset_at: string
          user_id: string
        }
        Insert: {
          id?: string
          previous_coins: number
          reset_at?: string
          user_id: string
        }
        Update: {
          id?: string
          previous_coins?: number
          reset_at?: string
          user_id?: string
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
      coin_candles: {
        Row: {
          c: number
          h: number
          l: number
          o: number
          t: string
        }
        Insert: {
          c: number
          h: number
          l: number
          o: number
          t: string
        }
        Update: {
          c?: number
          h?: number
          l?: number
          o?: number
          t?: string
        }
        Relationships: []
      }
      coin_market_state: {
        Row: {
          anchor: number
          at: string
          id: number
          price: number
          trend: number
          vol: number
        }
        Insert: {
          anchor: number
          at: string
          id?: number
          price: number
          trend: number
          vol: number
        }
        Update: {
          anchor?: number
          at?: string
          id?: number
          price?: number
          trend?: number
          vol?: number
        }
        Relationships: []
      }
      coin_positions: {
        Row: {
          close_reason: string | null
          closed_at: string | null
          entry: number
          exit_price: number | null
          id: string
          lots: number
          margin: number
          opened_at: string
          pnl: number | null
          side: string
          sl: number | null
          status: string
          tp: number | null
          user_id: string
        }
        Insert: {
          close_reason?: string | null
          closed_at?: string | null
          entry: number
          exit_price?: number | null
          id?: string
          lots: number
          margin: number
          opened_at?: string
          pnl?: number | null
          side: string
          sl?: number | null
          status?: string
          tp?: number | null
          user_id: string
        }
        Update: {
          close_reason?: string | null
          closed_at?: string | null
          entry?: number
          exit_price?: number | null
          id?: string
          lots?: number
          margin?: number
          opened_at?: string
          pnl?: number | null
          side?: string
          sl?: number | null
          status?: string
          tp?: number | null
          user_id?: string
        }
        Relationships: []
      }
      game_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          room: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          room: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          room?: string
          user_id?: string
        }
        Relationships: []
      }
      game_matches: {
        Row: {
          created_at: string
          creator_charged: boolean
          creator_id: string
          game_type: string
          house_fee: number
          id: string
          invite_code: string | null
          invited_user_id: string | null
          match_mode: string
          opponent_id: string | null
          stake: number
          state: string | null
          status: string
          turn: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          creator_charged?: boolean
          creator_id: string
          game_type: string
          house_fee?: number
          id?: string
          invite_code?: string | null
          invited_user_id?: string | null
          match_mode?: string
          opponent_id?: string | null
          stake: number
          state?: string | null
          status?: string
          turn?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          creator_charged?: boolean
          creator_id?: string
          game_type?: string
          house_fee?: number
          id?: string
          invite_code?: string | null
          invited_user_id?: string | null
          match_mode?: string
          opponent_id?: string | null
          stake?: number
          state?: string | null
          status?: string
          turn?: string | null
          updated_at?: string
          winner_id?: string | null
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
          username: string | null
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
          username?: string | null
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
          username?: string | null
        }
        Relationships: []
      }
      rules_answers: {
        Row: {
          answer: string
          created_at: string
          game: string
          hits: number
          id: string
          last_asked_at: string
          question: string
          question_key: string
        }
        Insert: {
          answer: string
          created_at?: string
          game: string
          hits?: number
          id?: string
          last_asked_at?: string
          question: string
          question_key: string
        }
        Update: {
          answer?: string
          created_at?: string
          game?: string
          hits?: number
          id?: string
          last_asked_at?: string
          question?: string
          question_key?: string
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
      wallet_withdrawals: {
        Row: {
          amount: number
          conversation_id: string | null
          created_at: string
          fee: number
          id: string
          mpesa_receipt: string | null
          originator_conversation_id: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          result_desc: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          conversation_id?: string | null
          created_at?: string
          fee?: number
          id?: string
          mpesa_receipt?: string | null
          originator_conversation_id?: string | null
          phone: string
          processed_at?: string | null
          processed_by?: string | null
          result_desc?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          conversation_id?: string | null
          created_at?: string
          fee?: number
          id?: string
          mpesa_receipt?: string | null
          originator_conversation_id?: string | null
          phone?: string
          processed_at?: string | null
          processed_by?: string | null
          result_desc?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_access_verified: { Args: never; Returns: boolean }
      admin_adjust_user_coins: {
        Args: { _delta: number; _user_id: string }
        Returns: undefined
      }
      admin_cancel_match: { Args: { _id: string }; Returns: undefined }
      admin_get_profit_summary: {
        Args: never
        Returns: {
          available: number
          total_fees: number
          total_withdrawn: number
        }[]
      }
      admin_record_profit_withdrawal: {
        Args: { _amount: number; _phone: string }
        Returns: string
      }
      admin_resolve_wallet_withdrawal: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      admin_set_user_banned: {
        Args: { _banned: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_user_coins: {
        Args: { _balance: number; _user_id: string }
        Returns: undefined
      }
      apply_verified_game_move: {
        Args: {
          _id: string
          _next: string
          _previous: string
          _result: string
          _uid: string
        }
        Returns: undefined
      }
      can_access_chat_room: { Args: { _room: string }; Returns: boolean }
      charge_service_continuation: {
        Args: { _slug: string; _uid: string }
        Returns: number
      }
      coin_check_positions: { Args: never; Returns: undefined }
      coin_close: { Args: { _id: string }; Returns: undefined }
      coin_feed: {
        Args: { _since: string }
        Returns: {
          c: number
          h: number
          l: number
          o: number
          t: string
        }[]
        SetofOptions: {
          from: "*"
          to: "coin_candles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      coin_open: {
        Args: { _lots: number; _side: string; _sl: number; _tp: number }
        Returns: string
      }
      coin_set_levels: {
        Args: { _id: string; _sl: number; _tp: number }
        Returns: undefined
      }
      coin_settle: {
        Args: { _exit: number; _id: string; _reason: string }
        Returns: undefined
      }
      coin_sync: { Args: never; Returns: undefined }
      confirm_stk_deposit: {
        Args: {
          _checkout: string
          _description: string
          _receipt: string
          _success: boolean
        }
        Returns: string
      }
      game_charge_entry: {
        Args: { _game: string; _stake: number; _uid: string }
        Returns: undefined
      }
      game_create_match: {
        Args: { _game: string; _stake: number; _state: string }
        Returns: string
      }
      game_create_match_with_mode: {
        Args: {
          _game: string
          _invite_code?: string
          _match_mode: string
          _opponent_id?: string
          _stake: number
          _state: string
        }
        Returns: string
      }
      game_entry_fee: { Args: { _stake: number }; Returns: number }
      game_is_locked: { Args: { _game: string }; Returns: boolean }
      game_join_match: { Args: { _id: string }; Returns: undefined }
      game_join_match_by_code: { Args: { _code: string }; Returns: string }
      game_move: {
        Args: { _id: string; _result: string; _state: string }
        Returns: undefined
      }
      game_resign: { Args: { _id: string }; Returns: undefined }
      game_settle: {
        Args: { _id: string; _winner: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_match_checked: {
        Args: { _code: string; _id: string }
        Returns: undefined
      }
      payout_complete: {
        Args: {
          _conversation_id: string
          _desc: string
          _id: string
          _kind: string
          _originator_id: string
          _receipt: string
          _success: boolean
        }
        Returns: string
      }
      payout_mark_processing: {
        Args: {
          _conversation_id: string
          _id: string
          _kind: string
          _originator_id: string
        }
        Returns: undefined
      }
      payout_reserve_profit: {
        Args: { _amount: number; _phone: string; _uid: string }
        Returns: string
      }
      payout_reserve_wallet: {
        Args: { _amount: number; _phone: string; _uid: string }
        Returns: string
      }
      quiz_decide: { Args: { _id: string }; Returns: undefined }
      quiz_finalize: { Args: { _id: string }; Returns: undefined }
      quiz_submit: {
        Args: { _answers: number[]; _id: string }
        Returns: undefined
      }
      request_wallet_withdrawal: {
        Args: { _amount: number; _phone: string }
        Returns: string
      }
      set_username: { Args: { _username: string }; Returns: string }
      setting_int: {
        Args: { _default: number; _field: string; _key: string }
        Returns: number
      }
      withdrawal_fee: { Args: { _amount: number }; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
