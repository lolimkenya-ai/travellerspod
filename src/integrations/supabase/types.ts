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
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_addr: string | null
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_addr?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_addr?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      board_posts: {
        Row: {
          added_at: string
          board_id: string
          post_id: string
        }
        Insert: {
          added_at?: string
          board_id: string
          post_id: string
        }
        Update: {
          added_at?: string
          board_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_details: {
        Row: {
          address: string | null
          associations: string | null
          category: string | null
          category_slug: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          facebook: string | null
          instagram: string | null
          linkedin: string | null
          profile_id: string
          registration_number: string | null
          tiktok: string | null
          twitter: string | null
          updated_at: string
          website: string | null
          youtube: string | null
        }
        Insert: {
          address?: string | null
          associations?: string | null
          category?: string | null
          category_slug?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          facebook?: string | null
          instagram?: string | null
          linkedin?: string | null
          profile_id: string
          registration_number?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Update: {
          address?: string | null
          associations?: string | null
          category?: string | null
          category_slug?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          facebook?: string | null
          instagram?: string | null
          linkedin?: string | null
          profile_id?: string
          registration_number?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_details_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "business_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          added_by: string | null
          business_id: string
          created_at: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          added_by?: string | null
          business_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          added_by?: string | null
          business_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_inquiry: boolean
          last_message: string | null
          last_message_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_inquiry?: boolean
          last_message?: string | null
          last_message_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_inquiry?: boolean
          last_message?: string | null
          last_message_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          body: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          inline_repost_post_id: string | null
          likes_count: number
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          inline_repost_post_id?: string | null
          likes_count?: number
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          inline_repost_post_id?: string | null
          likes_count?: number
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_inline_repost_post_id_fkey"
            columns: ["inline_repost_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          position: number
          post_id: string
          poster_url: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          position?: number
          post_id: string
          poster_url?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          post_id?: string
          poster_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          caption: string
          category_slug: string | null
          comments_count: number
          created_at: string
          id: string
          is_ad: boolean
          is_broadcast: boolean
          likes_count: number
          location: string | null
          media_count: number
          media_type: Database["public"]["Enums"]["media_type"]
          media_url: string | null
          poster_url: string | null
          quote_post_id: string | null
          saves_count: number
          text_background: string | null
          text_foreground: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          caption: string
          category_slug?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          is_ad?: boolean
          is_broadcast?: boolean
          likes_count?: number
          location?: string | null
          media_count?: number
          media_type: Database["public"]["Enums"]["media_type"]
          media_url?: string | null
          poster_url?: string | null
          quote_post_id?: string | null
          saves_count?: number
          text_background?: string | null
          text_foreground?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          caption?: string
          category_slug?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          is_ad?: boolean
          is_broadcast?: boolean
          likes_count?: number
          location?: string | null
          media_count?: number
          media_type?: Database["public"]["Enums"]["media_type"]
          media_url?: string | null
          poster_url?: string | null
          quote_post_id?: string | null
          saves_count?: number
          text_background?: string | null
          text_foreground?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "posts_quote_post_id_fkey"
            columns: ["quote_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          created_at: string
          danger_reason: string | null
          display_name: string
          flagged_danger: boolean
          followers_count: number
          following_count: number
          id: string
          nametag: string
          settings_completed: boolean
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified: boolean
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          danger_reason?: string | null
          display_name: string
          flagged_danger?: boolean
          followers_count?: number
          following_count?: number
          id: string
          nametag: string
          settings_completed?: boolean
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified?: boolean
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          danger_reason?: string | null
          display_name?: string
          flagged_danger?: boolean
          followers_count?: number
          following_count?: number
          id?: string
          nametag?: string
          settings_completed?: boolean
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified?: boolean
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          comment_policy: string
          dm_policy: string
          email_optin: boolean
          notify_broadcasts: boolean
          notify_comments: boolean
          notify_follows: boolean
          notify_inquiries: boolean
          notify_likes: boolean
          notify_reposts: boolean
          private_account: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_policy?: string
          dm_policy?: string
          email_optin?: boolean
          notify_broadcasts?: boolean
          notify_comments?: boolean
          notify_follows?: boolean
          notify_inquiries?: boolean
          notify_likes?: boolean
          notify_reposts?: boolean
          private_account?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_policy?: string
          dm_policy?: string
          email_optin?: boolean
          notify_broadcasts?: boolean
          notify_comments?: boolean
          notify_follows?: boolean
          notify_inquiries?: boolean
          notify_likes?: boolean
          notify_reposts?: boolean
          private_account?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_documents: {
        Row: {
          content_type: string | null
          created_at: string
          file_url: string
          flag_reason: string | null
          id: string
          label: string
          profile_id: string
          review_message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_url: string
          flag_reason?: string | null
          id?: string
          label: string
          profile_id: string
          review_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_url?: string
          flag_reason?: string | null
          id?: string
          label?: string
          profile_id?: string
          review_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      business_details_public: {
        Row: {
          associations: string | null
          category: string | null
          category_slug: string | null
          country: string | null
          facebook: string | null
          instagram: string | null
          linkedin: string | null
          profile_id: string | null
          tiktok: string | null
          twitter: string | null
          updated_at: string | null
          website: string | null
          youtube: string | null
        }
        Insert: {
          associations?: string | null
          category?: string | null
          category_slug?: string | null
          country?: string | null
          facebook?: string | null
          instagram?: string | null
          linkedin?: string | null
          profile_id?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string | null
          website?: string | null
          youtube?: string | null
        }
        Update: {
          associations?: string | null
          category?: string | null
          category_slug?: string | null
          country?: string | null
          facebook?: string | null
          instagram?: string | null
          linkedin?: string | null
          profile_id?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string | null
          website?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_details_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "business_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { _action: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      claim_first_admin: { Args: never; Returns: boolean }
      decide_verification: {
        Args: { _decision: string; _profile: string; _reason?: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      ensure_super_admin: { Args: never; Returns: boolean }
      flag_document: {
        Args: { _doc: string; _flagged: boolean; _reason?: string }
        Returns: undefined
      }
      gc_rate_limits: { Args: never; Returns: undefined }
      get_profile_moderation: {
        Args: { _profile: string }
        Returns: {
          danger_reason: string
          flagged_danger: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_business_member: {
        Args: {
          _business: string
          _min_role?: Database["public"]["Enums"]["business_role"]
          _user: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type?: string
          _metadata?: Json
        }
        Returns: undefined
      }
      mark_conversation_read: { Args: { _conv: string }; Returns: undefined }
      maybe_grant_super_admin: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      post_as_official: {
        Args: {
          _caption: string
          _category_slug?: string
          _is_broadcast?: boolean
          _location?: string
          _text_background?: string
          _text_foreground?: string
        }
        Returns: string
      }
      set_user_danger: {
        Args: { _flagged: boolean; _reason?: string; _user: string }
        Returns: undefined
      }
      start_dm: {
        Args: { _is_inquiry?: boolean; _other: string }
        Returns: string
      }
    }
    Enums: {
      account_type: "personal" | "business" | "organization"
      app_role: "admin" | "user" | "super_admin" | "moderator"
      business_role: "owner" | "manager" | "editor"
      media_type: "video" | "image" | "text"
      notification_type:
        | "like"
        | "comment"
        | "follow"
        | "repost"
        | "inquiry"
        | "verified"
      verification_status: "unverified" | "pending" | "verified"
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
      account_type: ["personal", "business", "organization"],
      app_role: ["admin", "user", "super_admin", "moderator"],
      business_role: ["owner", "manager", "editor"],
      media_type: ["video", "image", "text"],
      notification_type: [
        "like",
        "comment",
        "follow",
        "repost",
        "inquiry",
        "verified",
      ],
      verification_status: ["unverified", "pending", "verified"],
    },
  },
} as const
