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
          {
            foreignKeyName: "ai_flags_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_safe"
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
          {
            foreignKeyName: "auction_events_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_safe"
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
            foreignKeyName: "auction_extensions_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_safe"
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
      auction_payment_acceptances: {
        Row: {
          accepted_at: string
          auction_id: string
          bid_id: string
          delivery_snapshot: Json | null
          id: string
          methods_snapshot: Json
          user_id: string
        }
        Insert: {
          accepted_at?: string
          auction_id: string
          bid_id: string
          delivery_snapshot?: Json | null
          id?: string
          methods_snapshot: Json
          user_id: string
        }
        Update: {
          accepted_at?: string
          auction_id?: string
          bid_id?: string
          delivery_snapshot?: Json | null
          id?: string
          methods_snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_payment_acceptances_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_payment_acceptances_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_payment_acceptances_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: true
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_payment_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_private: {
        Row: {
          auction_id: string
          expected_price: number | null
          reserve_price: number | null
          service_budget: number | null
        }
        Insert: {
          auction_id: string
          expected_price?: number | null
          reserve_price?: number | null
          service_budget?: number | null
        }
        Update: {
          auction_id?: string
          expected_price?: number | null
          reserve_price?: number | null
          service_budget?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_private_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_private_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_push_events: {
        Row: {
          auction_id: string
          created_at: string
        }
        Insert: {
          auction_id: string
          created_at?: string
        }
        Update: {
          auction_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_push_events_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_push_events_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          accepted_payment_methods: Json
          auction_type: string
          bid_count: number
          category_id: string | null
          city: string | null
          closing_mode: string
          country: string | null
          created_at: string
          currency: string
          current_price: number | null
          delivery_snapshot: Json | null
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
          quiet_period_seconds: number
          reserve_met: boolean
          scope: string
          selection_pending: boolean
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
          accepted_payment_methods?: Json
          auction_type?: string
          bid_count?: number
          category_id?: string | null
          city?: string | null
          closing_mode?: string
          country?: string | null
          created_at?: string
          currency?: string
          current_price?: number | null
          delivery_snapshot?: Json | null
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
          quiet_period_seconds?: number
          reserve_met?: boolean
          scope?: string
          selection_pending?: boolean
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
          accepted_payment_methods?: Json
          auction_type?: string
          bid_count?: number
          category_id?: string | null
          city?: string | null
          closing_mode?: string
          country?: string | null
          created_at?: string
          currency?: string
          current_price?: number | null
          delivery_snapshot?: Json | null
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
          quiet_period_seconds?: number
          reserve_met?: boolean
          scope?: string
          selection_pending?: boolean
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
          conditions: string
          created_at: string
          id: string
          idempotency_key: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          conditions?: string
          created_at?: string
          id?: string
          idempotency_key: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          conditions?: string
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
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_safe"
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
      membership_review_events: {
        Row: {
          actor_id: string
          created_at: string
          decision: string
          id: string
          proof_values: Json | null
          reason: string | null
          request_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          decision: string
          id?: string
          proof_values?: Json | null
          reason?: string | null
          request_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          decision?: string
          id?: string
          proof_values?: Json | null
          reason?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_review_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "subscription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          created_at: string
          id: string
          sender_id: string
          submission_key: string | null
          transaction_id: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          created_at?: string
          id?: string
          sender_id: string
          submission_key?: string | null
          transaction_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          submission_key?: string | null
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
      notification_preferences: {
        Row: {
          activity: boolean
          categories: string[]
          new_auctions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: boolean
          categories?: string[]
          new_auctions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: boolean
          categories?: string[]
          new_auctions?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_push_outbox: {
        Row: {
          claimed_at: string | null
          created_at: string
          device_id: string
          id: string
          notification_id: string
          status: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          device_id: string
          id?: string
          notification_id: string
          status?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          device_id?: string
          id?: string
          notification_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_outbox_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      operation_events: {
        Row: {
          actor_id: string
          created_at: string
          details: Json
          id: string
          kind: string
          transaction_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          kind: string
          transaction_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      push_devices: {
        Row: {
          active: boolean
          created_at: string
          id: string
          subscription: Json | null
          token: string
          transport: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          subscription?: Json | null
          token: string
          transport?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          subscription?: Json | null
          token?: string
          transport?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_outbox: {
        Row: {
          auction_id: string
          claimed_at: string | null
          created_at: string
          device_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          auction_id: string
          claimed_at?: string | null
          created_at?: string
          device_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          claimed_at?: string | null
          created_at?: string
          device_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_user_id_fkey"
            columns: ["user_id"]
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
      service_requests: {
        Row: {
          auction_id: string
          locations_verified: boolean
          request: Json
          updated_at: string
        }
        Insert: {
          auction_id: string
          locations_verified?: boolean
          request: Json
          updated_at?: string
        }
        Update: {
          auction_id?: string
          locations_verified?: boolean
          request?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          active: boolean
          id: string
          label: string
          network: string
          sort: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          id?: string
          label: string
          network: string
          sort?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          id?: string
          label?: string
          network?: string
          sort?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          created_at: string
          id: string
          method_snapshot: Json
          payment_method_id: string | null
          plan_id: string
          plan_snapshot: Json
          proof_values: Json
          reference: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number
          status: string
          submission_key: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          method_snapshot?: Json
          payment_method_id?: string | null
          plan_id: string
          plan_snapshot?: Json
          proof_values?: Json
          reference?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          status?: string
          submission_key?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          method_snapshot?: Json
          payment_method_id?: string | null
          plan_id?: string
          plan_snapshot?: Json
          proof_values?: Json
          reference?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          status?: string
          submission_key?: string | null
          subscription_id?: string | null
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
          agreed_method: string | null
          amount: number
          auction_id: string
          buyer_confirmed: boolean
          buyer_confirmed_at: string | null
          buyer_id: string
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          payment_stage: string
          seller_confirmed: boolean
          seller_confirmed_at: string | null
          seller_id: string
          status: string
        }
        Insert: {
          agreed_method?: string | null
          amount: number
          auction_id: string
          buyer_confirmed?: boolean
          buyer_confirmed_at?: string | null
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_stage?: string
          seller_confirmed?: boolean
          seller_confirmed_at?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          agreed_method?: string | null
          amount?: number
          auction_id?: string
          buyer_confirmed?: boolean
          buyer_confirmed_at?: string | null
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_stage?: string
          seller_confirmed?: boolean
          seller_confirmed_at?: string | null
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
            foreignKeyName: "transactions_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions_safe"
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
          source_subscription_id: string | null
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
          source_subscription_id?: string | null
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
          source_subscription_id?: string | null
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
      auctions_safe: {
        Row: {
          accepted_payment_methods: Json | null
          auction_type: string | null
          bid_count: number | null
          category_id: string | null
          city: string | null
          closing_mode: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          current_price: number | null
          delivery_snapshot: Json | null
          delivery_terms: string | null
          description: string | null
          duration_hours: number | null
          duration_minutes: number | null
          ends_at: string | null
          extensions_count: number | null
          flagged: boolean | null
          has_reserve: boolean | null
          id: string | null
          images: string[] | null
          leader_id: string | null
          min_increment: number | null
          original_ends_at: string | null
          quiet_period_seconds: number | null
          reserve_met: boolean | null
          scope: string | null
          selection_pending: boolean | null
          seller_id: string | null
          service_from: string | null
          service_to: string | null
          starting_price: number | null
          starts_at: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          accepted_payment_methods?: Json | null
          auction_type?: string | null
          bid_count?: number | null
          category_id?: string | null
          city?: string | null
          closing_mode?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          current_price?: number | null
          delivery_snapshot?: Json | null
          delivery_terms?: string | null
          description?: string | null
          duration_hours?: number | null
          duration_minutes?: number | null
          ends_at?: string | null
          extensions_count?: number | null
          flagged?: boolean | null
          has_reserve?: boolean | null
          id?: string | null
          images?: never
          leader_id?: string | null
          min_increment?: number | null
          original_ends_at?: string | null
          quiet_period_seconds?: number | null
          reserve_met?: boolean | null
          scope?: string | null
          selection_pending?: boolean | null
          seller_id?: string | null
          service_from?: never
          service_to?: never
          starting_price?: never
          starts_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          accepted_payment_methods?: Json | null
          auction_type?: string | null
          bid_count?: number | null
          category_id?: string | null
          city?: string | null
          closing_mode?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          current_price?: number | null
          delivery_snapshot?: Json | null
          delivery_terms?: string | null
          description?: string | null
          duration_hours?: number | null
          duration_minutes?: number | null
          ends_at?: string | null
          extensions_count?: number | null
          flagged?: boolean | null
          has_reserve?: boolean | null
          id?: string | null
          images?: never
          leader_id?: string | null
          min_increment?: number | null
          original_ends_at?: string | null
          quiet_period_seconds?: number | null
          reserve_met?: boolean | null
          scope?: string | null
          selection_pending?: boolean | null
          seller_id?: string | null
          service_from?: never
          service_to?: never
          starting_price?: never
          starts_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
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
      advance_operation: {
        Args: { _method?: string; _stage: string; _tx: string }
        Returns: undefined
      }
      apply_referral_commission: {
        Args: { _buyer: string; _plan: string }
        Returns: undefined
      }
      apply_referral_commission_paid: {
        Args: {
          _amount: number
          _buyer: string
          _currency: string
          _subscription: string
        }
        Returns: number
      }
      auction_bid_deadline: {
        Args: {
          _end: string
          _met: boolean
          _mode: string
          _now: string
          _quiet: number
        }
        Returns: string
      }
      auction_image_readable: { Args: { _name: string }; Returns: boolean }
      become_seller: { Args: never; Returns: undefined }
      bid_with_delivery_acceptance: {
        Args: {
          _accept: boolean
          _amount: number
          _auction: string
          _conditions?: string
          _delivery: Json
          _key: string
          _terms: Json
        }
        Returns: Json
      }
      bid_with_payment_acceptance: {
        Args: {
          _accept: boolean
          _amount: number
          _auction: string
          _conditions?: string
          _key: string
          _terms: Json
        }
        Returns: Json
      }
      cancel_auction: {
        Args: { _auction_id: string; _reason: string }
        Returns: undefined
      }
      choose_service_provider: {
        Args: { _auction: string; _bid: string }
        Returns: string
      }
      claim_notification_push_batch: {
        Args: { _limit?: number }
        Returns: {
          auction_id: string
          body: string
          category_name: string
          currency: string
          device_id: string
          image_path: string
          notification_id: string
          path: string
          queue_id: string
          starting_price: number
          subscription: Json
          title: string
        }[]
      }
      claim_push_batch: {
        Args: { _limit?: number }
        Returns: {
          auction_id: string
          category_name: string
          device_id: string
          device_token: string
          image_path: string
          queue_id: string
          title: string
        }[]
      }
      claim_referral: { Args: { _code: string }; Returns: string }
      claim_web_push_batch: {
        Args: { _limit?: number }
        Returns: {
          auction_id: string
          category_name: string
          device_id: string
          image_path: string
          queue_id: string
          subscription: Json
          title: string
        }[]
      }
      close_if_due: { Args: { _auction_id: string }; Returns: undefined }
      confirm_transaction: { Args: { _tx: string }; Returns: undefined }
      get_service_request: { Args: { _auction: string }; Returns: Json }
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
      my_auction_draft: { Args: { _id: string }; Returns: Json }
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
      my_referral_community: {
        Args: never
        Returns: {
          currency: string
          display_name: string
          earned: number
          ends_at: string
          id: string
          joined_at: string
          plan_active: boolean
          plan_name: string
        }[]
      }
      new_auction_draft: {
        Args: { _data: Json; _private: Json }
        Returns: string
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
          accepted_payment_methods: Json
          auction_type: string
          bid_count: number
          category_id: string | null
          city: string | null
          closing_mode: string
          country: string | null
          created_at: string
          currency: string
          current_price: number | null
          delivery_snapshot: Json | null
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
          quiet_period_seconds: number
          reserve_met: boolean
          scope: string
          selection_pending: boolean
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
      review_manual_membership: {
        Args: { _decision: string; _reason?: string; _request: string }
        Returns: string
      }
      save_auction_draft: {
        Args: { _data: Json; _id: string; _private: Json }
        Returns: string
      }
      save_extended_draft: {
        Args: {
          _data: Json
          _delivery: Json
          _id?: string
          _private: Json
          _request: Json
        }
        Returns: string
      }
      send_operation_message: {
        Args: { _attachment?: string; _body: string; _key: string; _tx: string }
        Returns: string
      }
      service_bid_conditions: {
        Args: {
          _amount: number
          _auction: string
          _conditions: string
          _key: string
        }
        Returns: Json
      }
      service_details_allowed: { Args: { _auction: string }; Returns: boolean }
      service_required_fields: {
        Args: { _category: string }
        Returns: string[]
      }
      set_auction_start: {
        Args: { _auction_id: string; _starts_at: string }
        Returns: undefined
      }
      set_service_locations_verified: {
        Args: { _auction: string; _verified: boolean }
        Returns: undefined
      }
      submit_manual_membership: {
        Args: {
          _key: string
          _method: string
          _plan: string
          _request?: string
          _values: Json
        }
        Returns: string
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
