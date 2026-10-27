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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: number
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: number
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: number
          target?: string | null
        }
        Relationships: []
      }
      ai_flags: {
        Row: {
          auction_id: string | null
          created_at: string
          id: string
          reason: string
          reviewed_by: string | null
          severity: string
          status: string
        }
        Insert: {
          auction_id?: string | null
          created_at?: string
          id?: string
          reason: string
          reviewed_by?: string | null
          severity?: string
          status?: string
        }
        Update: {
          auction_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          reviewed_by?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_flags_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_events: {
        Row: {
          auction_id: string
          created_at: string
          details: Json | null
          id: number
          kind: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          details?: Json | null
          id?: number
          kind: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          details?: Json | null
          id?: number
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_events_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_extensions: {
        Row: {
          auction_id: string
          bid_id: string
          created_at: string
          id: number
          new_ends_at: string
          old_ends_at: string
          reason: string
        }
        Insert: {
          auction_id: string
          bid_id: string
          created_at?: string
          id?: number
          new_ends_at: string
          old_ends_at: string
          reason: string
        }
        Update: {
          auction_id?: string
          bid_id?: string
          created_at?: string
          id?: number
          new_ends_at?: string
          old_ends_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_extensions_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_extensions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_private: {
        Row: {
          auction_id: string
          expected_price: number | null
          reserve_price: number | null
        }
        Insert: {
          auction_id: string
          expected_price?: number | null
          reserve_price?: number | null
        }
        Update: {
          auction_id?: string
          expected_price?: number | null
          reserve_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_private_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          auction_type: string
          bid_count: number
          category_id: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          current_price: number | null
          delivery_terms: string
          description: string
          duration_hours: number
          duration_minutes: number | null
          ends_at: string | null
          extensions_count: number
          flagged: boolean
          has_reserve: boolean
          id: string
          images: string[]
          leader_id: string | null
          min_increment: number
          original_ends_at: string | null
          reserve_met: boolean
          scope: string
          seller_id: string
          service_from: string | null
          service_to: string | null
          starting_price: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          auction_type?: string
          bid_count?: number
          category_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          current_price?: number | null
          delivery_terms?: string
          description?: string
          duration_hours?: number
          duration_minutes?: number | null
          ends_at?: string | null
          extensions_count?: number
          flagged?: boolean
          has_reserve?: boolean
          id?: string
          images?: string[]
          leader_id?: string | null
          min_increment?: number
          original_ends_at?: string | null
          reserve_met?: boolean
          scope?: string
          seller_id: string
          service_from?: string | null
          service_to?: string | null
          starting_price?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          auction_type?: string
          bid_count?: number
          category_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          current_price?: number | null
          delivery_terms?: string
          description?: string
          duration_hours?: number
          duration_minutes?: number | null
          ends_at?: string | null
          extensions_count?: number
          flagged?: boolean
          has_reserve?: boolean
          id?: string
          images?: string[]
          leader_id?: string | null
          min_increment?: number
          original_ends_at?: string | null
          reserve_met?: boolean
          scope?: string
          seller_id?: string
          service_from?: string | null
          service_to?: string | null
          starting_price?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string
          id: string
          idempotency_key: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string
          id?: string
          idempotency_key: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          opened_by: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened_by: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opened_by?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          transaction_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          transaction_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          details: Json
          id: string
          instructions: string
          kind: string
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          details?: Json
          id?: string
          instructions?: string
          kind?: string
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          details?: Json
          id?: string
          instructions?: string
          kind?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          audience: string
          benefits: string[]
          created_at: string
          currency: string
          id: string
          max_active_auctions: number | null
          months: number
          name: string
          period: string
          price: number | null
          referral_pct: number
        }
        Insert: {
          active?: boolean
          audience: string
          benefits?: string[]
          created_at?: string
          currency?: string
          id?: string
          max_active_auctions?: number | null
          months?: number
          name: string
          period?: string
          price?: number | null
          referral_pct?: number
        }
        Update: {
          active?: boolean
          audience?: string
          benefits?: string[]
          created_at?: string
          currency?: string
          id?: string
          max_active_auctions?: number | null
          months?: number
          name?: string
          period?: string
          price?: number | null
          referral_pct?: number
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          extension_seconds: number
          id: number
          max_duration_days: number
          min_duration_hours: number
          min_increment: number
          updated_at: string
          values_approved: boolean
        }
        Insert: {
          extension_seconds?: number
          id?: number
          max_duration_days?: number
          min_duration_hours?: number
          min_increment?: number
          updated_at?: string
          values_approved?: boolean
        }
        Update: {
          extension_seconds?: number
          id?: number
          max_duration_days?: number
          min_duration_hours?: number
          min_increment?: number
          updated_at?: string
          values_approved?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          display_name: string
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
        }
        Insert: {
          account_status?: string
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          id: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
        }
        Update: {
          account_status?: string
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          transaction_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          transaction_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_requests: {
        Row: {
          created_at: string
          id: string
          payment_method_id: string | null
          plan_id: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_method_id?: string | null
          plan_id: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_method_id?: string | null
          plan_id?: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string
          granted_by: string | null
          id: string
          plan_id: string
          starts_at: string
          status: string
          test_mode: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          granted_by?: string | null
          id?: string
          plan_id: string
          starts_at?: string
          status?: string
          test_mode?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          granted_by?: string | null
          id?: string
          plan_id?: string
          starts_at?: string
          status?: string
          test_mode?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          auction_id: string
          buyer_confirmed: boolean
          buyer_id: string
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          seller_confirmed: boolean
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          auction_id: string
          buyer_confirmed?: boolean
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          seller_confirmed?: boolean
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          auction_id?: string
          buyer_confirmed?: boolean
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          seller_confirmed?: boolean
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          kind: string
          note: string
          ref_user_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          kind: string
          note?: string
          ref_user_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          note?: string
          ref_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_reputation: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cancel_subscription: { Args: { _sub: string }; Returns: undefined }
      admin_grant_subscription: {
        Args: { _months: number; _plan: string; _user: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          account_status: string
          created_at: string
          display_name: string
          email: string
          id: string
          roles: string[]
          seller_sub_until: string
        }[]
      }
      admin_review_flag: {
        Args: { _flag: string; _status: string }
        Returns: undefined
      }
      admin_review_subscription: {
        Args: { _approve: boolean; _request: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      admin_set_status: {
        Args: { _status: string; _user: string }
        Returns: undefined
      }
      admin_update_settings: {
        Args: { _max_days: number; _min_hours: number; _min_increment: number }
        Returns: undefined
      }
      apply_referral_commission: {
        Args: { _buyer: string; _plan: string }
        Returns: undefined
      }
      become_seller: { Args: never; Returns: undefined }
      cancel_auction: {
        Args: { _auction_id: string; _reason: string }
        Returns: undefined
      }
      close_if_due: { Args: { _auction_id: string }; Returns: undefined }
      confirm_transaction: { Args: { _tx: string }; Returns: undefined }
      has_active_seller_sub: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_tx_party: { Args: { _tx: string; _user: string }; Returns: boolean }
      leave_review: {
        Args: { _comment: string; _rating: number; _tx: string }
        Returns: undefined
      }
      my_profile: {
        Args: never
        Returns: {
          account_status: string
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          display_name: string
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify: {
        Args: { _body: string; _link: string; _title: string; _user: string }
        Returns: undefined
      }
      open_dispute: {
        Args: { _reason: string; _tx: string }
        Returns: undefined
      }
      pay_membership_with_wallet: {
        Args: { _for_user?: string; _plan: string }
        Returns: string
      }
      place_bid: {
        Args: { _amount: number; _auction_id: string; _idempotency_key: string }
        Returns: Json
      }
      process_auctions: { Args: never; Returns: number }
      publish_auction: {
        Args: { _auction_id: string }
        Returns: {
          auction_type: string
          bid_count: number
          category_id: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          current_price: number | null
          delivery_terms: string
          description: string
          duration_hours: number
          duration_minutes: number | null
          ends_at: string | null
          extensions_count: number
          flagged: boolean
          has_reserve: boolean
          id: string
          images: string[]
          leader_id: string | null
          min_increment: number
          original_ends_at: string | null
          reserve_met: boolean
          scope: string
          seller_id: string
          service_from: string | null
          service_to: string | null
          starting_price: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "auctions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_dispute: {
        Args: {
          _dispute: string
          _resolution: string
          _status: string
          _tx_status: string
        }
        Returns: undefined
      }
      set_auction_start: {
        Args: { _auction_id: string; _starts_at: string }
        Returns: undefined
      }
      transfer_credit: {
        Args: { _amount: number; _to_code: string }
        Returns: undefined
      }
      tx_contact: {
        Args: { _tx: string }
        Returns: {
          display_name: string
          phone: string
          user_id: string
        }[]
      }
      wallet_balance: { Args: { _user: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "seller" | "buyer"
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
      app_role: ["admin", "moderator", "seller", "buyer"],
    },
  },
} as const
