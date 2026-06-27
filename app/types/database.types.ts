export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_locks: {
        Row: {
          email: string
          failed_attempts: number | null
          id: string
          locked_at: string | null
          locked_until: string
        }
        Insert: {
          email: string
          failed_attempts?: number | null
          id?: string
          locked_at?: string | null
          locked_until: string
        }
        Update: {
          email?: string
          failed_attempts?: number | null
          id?: string
          locked_at?: string | null
          locked_until?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_log: {
        Row: {
          created_at: string | null
          email: string | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          from_plan_id: string | null
          id: string
          organization_id: string
          stripe_event_id: string | null
          subscription_id: string | null
          to_plan_id: string | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          from_plan_id?: string | null
          id?: string
          organization_id: string
          stripe_event_id?: string | null
          subscription_id?: string | null
          to_plan_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          from_plan_id?: string | null
          id?: string
          organization_id?: string
          stripe_event_id?: string | null
          subscription_id?: string | null
          to_plan_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_articles: {
        Row: {
          alt_text: string | null
          author: string | null
          content_html: string
          content_markdown: string
          created_at: string
          id: string
          image_url: string | null
          meta_description: string
          outrank_id: string | null
          slug: string
          status: string
          tags: Json
          title: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          author?: string | null
          content_html?: string
          content_markdown?: string
          created_at?: string
          id?: string
          image_url?: string | null
          meta_description?: string
          outrank_id?: string | null
          slug: string
          status?: string
          tags?: Json
          title: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          author?: string | null
          content_html?: string
          content_markdown?: string
          created_at?: string
          id?: string
          image_url?: string | null
          meta_description?: string
          outrank_id?: string | null
          slug?: string
          status?: string
          tags?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          created_at: string
          marketing_unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          marketing_unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          marketing_unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      environment_access: {
        Row: {
          access_level: string
          created_at: string
          environment_id: string
          granted_by: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          environment_id: string
          granted_by: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          environment_id?: string
          granted_by?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "environment_access_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_approvers: {
        Row: {
          created_at: string | null
          created_by: string | null
          environment_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          environment_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          environment_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "environment_approvers_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_integration_configs: {
        Row: {
          created_at: string
          enabled: boolean
          environment_id: string
          id: string
          last_synced_at: string | null
          prefix: string | null
          project_integration_id: string
          service_id: string | null
          target_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment_id: string
          id?: string
          last_synced_at?: string | null
          prefix?: string | null
          project_integration_id: string
          service_id?: string | null
          target_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment_id?: string
          id?: string
          last_synced_at?: string | null
          prefix?: string | null
          project_integration_id?: string
          service_id?: string | null
          target_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environment_integration_configs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_integration_configs_project_integration_id_fkey"
            columns: ["project_integration_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_integration_configs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_schemas: {
        Row: {
          created_at: string
          created_by: string
          environment_id: string
          id: string
          organization_id: string
          schema_json: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          environment_id: string
          id?: string
          organization_id: string
          schema_json: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          environment_id?: string
          id?: string
          organization_id?: string
          schema_json?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "environment_schemas_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: true
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_schemas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_snapshots: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          environment_id: string
          id: string
          name: string
          organization_id: string
          snapshot_data: Json
          variable_count: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          environment_id: string
          id?: string
          name: string
          organization_id: string
          snapshot_data: Json
          variable_count: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          environment_id?: string
          id?: string
          name?: string
          organization_id?: string
          snapshot_data?: Json
          variable_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "environment_snapshots_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          approval_mode: string | null
          auto_expire_hours: number | null
          created_at: string
          friendly_id: number
          id: string
          is_protected: boolean
          name: string
          organization_id: string
          project_id: string
          show_values_to_readers: boolean
          updated_at: string
        }
        Insert: {
          approval_mode?: string | null
          auto_expire_hours?: number | null
          created_at?: string
          friendly_id: number
          id?: string
          is_protected?: boolean
          name: string
          organization_id: string
          project_id: string
          show_values_to_readers?: boolean
          updated_at?: string
        }
        Update: {
          approval_mode?: string | null
          auto_expire_hours?: number | null
          created_at?: string
          friendly_id?: number
          id?: string
          is_protected?: boolean
          name?: string
          organization_id?: string
          project_id?: string
          show_values_to_readers?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_webhooks: {
        Row: {
          created_at: string
          error_message: string
          event_data: Json | null
          event_type: string
          id: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error_message: string
          event_data?: Json | null
          event_type: string
          id?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error_message?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      github_environment_configs: {
        Row: {
          created_at: string
          enabled: boolean
          environment_id: string
          id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          prefix: string | null
          project_sync_config_id: string
          target_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment_id: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          prefix?: string | null
          project_sync_config_id: string
          target_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment_id?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          prefix?: string | null
          project_sync_config_id?: string
          target_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_environment_configs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_environment_configs_project_sync_config_id_fkey"
            columns: ["project_sync_config_id"]
            isOneToOne: false
            referencedRelation: "github_project_sync_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      github_installations: {
        Row: {
          account_id: number
          account_login: string
          account_type: string
          created_at: string | null
          id: string
          installation_id: number
          installed_at: string | null
          installed_by: string | null
          organization_id: string
          permissions: Json | null
          repository_selection: string | null
          suspended_at: string | null
          uninstalled_at: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: number
          account_login: string
          account_type: string
          created_at?: string | null
          id?: string
          installation_id: number
          installed_at?: string | null
          installed_by?: string | null
          organization_id: string
          permissions?: Json | null
          repository_selection?: string | null
          suspended_at?: string | null
          uninstalled_at?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: number
          account_login?: string
          account_type?: string
          created_at?: string | null
          id?: string
          installation_id?: number
          installed_at?: string | null
          installed_by?: string | null
          organization_id?: string
          permissions?: Json | null
          repository_selection?: string | null
          suspended_at?: string | null
          uninstalled_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_installations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      github_pending_syncs: {
        Row: {
          attempts: number
          created_at: string | null
          env_config_id: string | null
          environment_id: string
          id: string
          last_error: string | null
          processed_at: string | null
          status: string
          sync_config_id: string | null
          trigger_reason: string
          variable_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          env_config_id?: string | null
          environment_id: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
          sync_config_id?: string | null
          trigger_reason: string
          variable_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string | null
          env_config_id?: string | null
          environment_id?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
          sync_config_id?: string | null
          trigger_reason?: string
          variable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_pending_syncs_env_config_id_fkey"
            columns: ["env_config_id"]
            isOneToOne: false
            referencedRelation: "github_environment_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_pending_syncs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_pending_syncs_sync_config_id_fkey"
            columns: ["sync_config_id"]
            isOneToOne: false
            referencedRelation: "github_sync_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      github_project_sync_configs: {
        Row: {
          auto_sync: boolean
          created_at: string
          id: string
          installation_id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          project_id: string
          sync_mode: string
          sync_secrets: boolean
          sync_variables: boolean
          updated_at: string
          variable_storage_mode: string
        }
        Insert: {
          auto_sync?: boolean
          created_at?: string
          id?: string
          installation_id: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          project_id: string
          sync_mode?: string
          sync_secrets?: boolean
          sync_variables?: boolean
          updated_at?: string
          variable_storage_mode?: string
        }
        Update: {
          auto_sync?: boolean
          created_at?: string
          id?: string
          installation_id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          project_id?: string
          sync_mode?: string
          sync_secrets?: boolean
          sync_variables?: boolean
          updated_at?: string
          variable_storage_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_project_sync_configs_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "github_installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_project_sync_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      github_sync_configs: {
        Row: {
          auto_sync: boolean
          created_at: string | null
          created_by: string | null
          environment_id: string
          github_environment: string | null
          id: string
          installation_id: string
          last_sync_count: number | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          repo_name: string | null
          repo_owner: string | null
          sync_level: string
          sync_mode: string
          sync_secrets: boolean
          sync_variables: boolean
          updated_at: string | null
        }
        Insert: {
          auto_sync?: boolean
          created_at?: string | null
          created_by?: string | null
          environment_id: string
          github_environment?: string | null
          id?: string
          installation_id: string
          last_sync_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          repo_name?: string | null
          repo_owner?: string | null
          sync_level: string
          sync_mode?: string
          sync_secrets?: boolean
          sync_variables?: boolean
          updated_at?: string | null
        }
        Update: {
          auto_sync?: boolean
          created_at?: string | null
          created_by?: string | null
          environment_id?: string
          github_environment?: string | null
          id?: string
          installation_id?: string
          last_sync_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          repo_name?: string | null
          repo_owner?: string | null
          sync_level?: string
          sync_mode?: string
          sync_secrets?: boolean
          sync_variables?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_sync_configs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_sync_configs_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "github_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      github_sync_history: {
        Row: {
          completed_at: string | null
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          env_config_id: string | null
          error_message: string | null
          id: string
          secrets_synced: number
          started_at: string | null
          status: string
          sync_config_id: string | null
          trigger_type: string
          triggered_by: string | null
          variables_synced: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          env_config_id?: string | null
          error_message?: string | null
          id?: string
          secrets_synced?: number
          started_at?: string | null
          status: string
          sync_config_id?: string | null
          trigger_type: string
          triggered_by?: string | null
          variables_synced?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          env_config_id?: string | null
          error_message?: string | null
          id?: string
          secrets_synced?: number
          started_at?: string | null
          status?: string
          sync_config_id?: string | null
          trigger_type?: string
          triggered_by?: string | null
          variables_synced?: number
        }
        Relationships: [
          {
            foreignKeyName: "github_sync_history_env_config_id_fkey"
            columns: ["env_config_id"]
            isOneToOne: false
            referencedRelation: "github_environment_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_sync_history_sync_config_id_fkey"
            columns: ["sync_config_id"]
            isOneToOne: false
            referencedRelation: "github_sync_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      github_synced_keys: {
        Row: {
          env_config_id: string
          id: string
          last_synced_at: string
          variable_key: string
        }
        Insert: {
          env_config_id: string
          id?: string
          last_synced_at?: string
          variable_key: string
        }
        Update: {
          env_config_id?: string
          id?: string
          last_synced_at?: string
          variable_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_synced_keys_env_config_id_fkey"
            columns: ["env_config_id"]
            isOneToOne: false
            referencedRelation: "github_environment_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created_at: string | null
          environment_id: string
          file_name: string
          file_type: string
          id: string
          organization_id: string
          user_id: string
          variables_imported: number
          variables_overwritten: number
          variables_skipped: number
        }
        Insert: {
          created_at?: string | null
          environment_id: string
          file_name: string
          file_type: string
          id?: string
          organization_id: string
          user_id: string
          variables_imported?: number
          variables_overwritten?: number
          variables_skipped?: number
        }
        Update: {
          created_at?: string | null
          environment_id?: string
          file_name?: string
          file_type?: string
          id?: string
          organization_id?: string
          user_id?: string
          variables_imported?: number
          variables_overwritten?: number
          variables_skipped?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_history_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_email_log: {
        Row: {
          email_type: string
          id: string
          provider_message_id: string | null
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          email_type: string
          id?: string
          provider_message_id?: string | null
          sent_at?: string
          status: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          provider_message_id?: string | null
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          email: string
          id: string
          ip_address: unknown
          success: boolean
        }
        Insert: {
          attempted_at?: string | null
          email: string
          id?: string
          ip_address?: unknown
          success: boolean
        }
        Update: {
          attempted_at?: string | null
          email?: string
          id?: string
          ip_address?: unknown
          success?: boolean
        }
        Relationships: []
      }
      mfa_recovery_sessions: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      naming_conventions: {
        Row: {
          created_at: string | null
          created_by: string | null
          enforcement_mode: string
          id: string
          organization_id: string
          project_id: string | null
          rules: Json
          template_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          enforcement_mode?: string
          id?: string
          organization_id: string
          project_id?: string | null
          rules: Json
          template_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          enforcement_mode?: string
          id?: string
          organization_id?: string
          project_id?: string | null
          rules?: Json
          template_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "naming_conventions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "naming_conventions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: unknown
          source: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          source?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          source?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          canceled_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          canceled_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          canceled_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          organization_id: string
          plan_id: string
          proxy_metered_item_id: string | null
          scheduled_change_date: string | null
          scheduled_plan_change_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          plan_id: string
          proxy_metered_item_id?: string | null
          scheduled_change_date?: string | null
          scheduled_plan_change_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          plan_id?: string
          proxy_metered_item_id?: string | null
          scheduled_change_date?: string | null
          scheduled_plan_change_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_scheduled_plan_change_id_fkey"
            columns: ["scheduled_plan_change_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_usage: {
        Row: {
          api_calls_count: number
          created_at: string
          environments_count: number
          id: string
          organization_id: string
          period_end: string
          period_start: string
          projects_count: number
          snapshot_data: Json | null
          team_members_count: number
          updated_at: string
          variables_count: number
        }
        Insert: {
          api_calls_count?: number
          created_at?: string
          environments_count?: number
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          projects_count?: number
          snapshot_data?: Json | null
          team_members_count?: number
          updated_at?: string
          variables_count?: number
        }
        Update: {
          api_calls_count?: number
          created_at?: string
          environments_count?: number
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          projects_count?: number
          snapshot_data?: Json | null
          team_members_count?: number
          updated_at?: string
          variables_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          id: string
          name: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          id?: string
          name: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          id?: string
          name?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_changes: {
        Row: {
          action: string
          comment: string | null
          environment_id: string
          expires_at: string | null
          first_approved_at: string | null
          first_approver: string | null
          id: string
          is_secret: boolean | null
          old_key: string | null
          old_value: string | null
          organization_id: string
          rejection_reason: string | null
          requested_at: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          variable_id: string | null
          variable_key: string | null
          variable_value: string | null
        }
        Insert: {
          action: string
          comment?: string | null
          environment_id: string
          expires_at?: string | null
          first_approved_at?: string | null
          first_approver?: string | null
          id?: string
          is_secret?: boolean | null
          old_key?: string | null
          old_value?: string | null
          organization_id: string
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          variable_id?: string | null
          variable_key?: string | null
          variable_value?: string | null
        }
        Update: {
          action?: string
          comment?: string | null
          environment_id?: string
          expires_at?: string | null
          first_approved_at?: string | null
          first_approver?: string | null
          id?: string
          is_secret?: boolean | null
          old_key?: string | null
          old_value?: string | null
          organization_id?: string
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          variable_id?: string | null
          variable_key?: string | null
          variable_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_changes_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_changes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_changes_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "variables"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_auto_sync_queue: {
        Row: {
          change_type: string
          env_config_id: string
          id: string
          platform: string
          processed_at: string | null
          queued_at: string
          service_id: string | null
          variable_key: string | null
        }
        Insert: {
          change_type: string
          env_config_id: string
          id?: string
          platform: string
          processed_at?: string | null
          queued_at?: string
          service_id?: string | null
          variable_key?: string | null
        }
        Update: {
          change_type?: string
          env_config_id?: string
          id?: string
          platform?: string
          processed_at?: string | null
          queued_at?: string
          service_id?: string | null
          variable_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_auto_sync_queue_env_config_id_fkey"
            columns: ["env_config_id"]
            isOneToOne: true
            referencedRelation: "environment_integration_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_auto_sync_queue_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_integrations: {
        Row: {
          api_token_vault_id: string | null
          ca_cert_vault_id: string | null
          connected_at: string
          connected_by: string
          created_at: string
          disconnected_at: string | null
          id: string
          instance_url: string | null
          metadata: Json | null
          name: string
          organization_id: string
          platform: string
          skip_ssl_verify: boolean | null
          token_error: string | null
          token_valid: boolean | null
          token_validated_at: string | null
          updated_at: string
        }
        Insert: {
          api_token_vault_id?: string | null
          ca_cert_vault_id?: string | null
          connected_at?: string
          connected_by: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          instance_url?: string | null
          metadata?: Json | null
          name: string
          organization_id: string
          platform: string
          skip_ssl_verify?: boolean | null
          token_error?: string | null
          token_valid?: boolean | null
          token_validated_at?: string | null
          updated_at?: string
        }
        Update: {
          api_token_vault_id?: string | null
          ca_cert_vault_id?: string | null
          connected_at?: string
          connected_by?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          instance_url?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          platform?: string
          skip_ssl_verify?: boolean | null
          token_error?: string | null
          token_valid?: boolean | null
          token_validated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_sync_configs: {
        Row: {
          auto_sync: boolean
          connection_id: string
          created_at: string
          id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          project_id: string
          sync_secrets: boolean
          sync_variables: boolean
          target: Json
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean
          connection_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          project_id: string
          sync_secrets?: boolean
          sync_variables?: boolean
          target?: Json
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean
          connection_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          project_id?: string
          sync_secrets?: boolean
          sync_variables?: boolean
          target?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_sync_configs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_sync_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_sync_history: {
        Row: {
          created_at: string
          details: Json | null
          env_config_id: string
          error_message: string | null
          id: string
          secrets_synced: number
          status: string
          trigger_type: string
          triggered_by: string
          variables_synced: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          env_config_id: string
          error_message?: string | null
          id?: string
          secrets_synced?: number
          status: string
          trigger_type: string
          triggered_by: string
          variables_synced?: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          env_config_id?: string
          error_message?: string | null
          id?: string
          secrets_synced?: number
          status?: string
          trigger_type?: string
          triggered_by?: string
          variables_synced?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_sync_history_env_config_id_fkey"
            columns: ["env_config_id"]
            isOneToOne: false
            referencedRelation: "environment_integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_synced_keys: {
        Row: {
          env_config_id: string
          id: string
          last_synced_at: string
          platform_key_id: string | null
          variable_key: string
        }
        Insert: {
          env_config_id: string
          id?: string
          last_synced_at?: string
          platform_key_id?: string | null
          variable_key: string
        }
        Update: {
          env_config_id?: string
          id?: string
          last_synced_at?: string
          platform_key_id?: string | null
          variable_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_synced_keys_env_config_id_fkey"
            columns: ["env_config_id"]
            isOneToOne: false
            referencedRelation: "environment_integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          friendly_id: number
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          friendly_id: number
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          friendly_id?: number
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_function_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changes: Json | null
          created_at: string
          id: string
          organization_id: string
          proxy_function_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          organization_id: string
          proxy_function_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          organization_id?: string
          proxy_function_id?: string
        }
        Relationships: []
      }
      proxy_functions: {
        Row: {
          allowed_origins: Json
          created_at: string
          created_by: string
          description: string | null
          enabled: boolean
          environment_id: string
          http_method: string
          id: string
          name: string
          organization_id: string
          pass_through_body: boolean
          rate_limit_per_minute: number | null
          request_body_template: Json | null
          secret_mappings: Json
          secret_token: string
          service_id: string | null
          slug: string
          target_headers: Json
          target_url: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_origins?: Json
          created_at?: string
          created_by: string
          description?: string | null
          enabled?: boolean
          environment_id: string
          http_method?: string
          id?: string
          name: string
          organization_id: string
          pass_through_body?: boolean
          rate_limit_per_minute?: number | null
          request_body_template?: Json | null
          secret_mappings?: Json
          secret_token?: string
          service_id?: string | null
          slug: string
          target_headers?: Json
          target_url: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_origins?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          enabled?: boolean
          environment_id?: string
          http_method?: string
          id?: string
          name?: string
          organization_id?: string
          pass_through_body?: boolean
          rate_limit_per_minute?: number | null
          request_body_template?: Json | null
          secret_mappings?: Json
          secret_token?: string
          service_id?: string | null
          slug?: string
          target_headers?: Json
          target_url?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_functions_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_functions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_functions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_functions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proxy_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_invocation_logs: {
        Row: {
          error_type: string | null
          id: string
          organization_id: string
          origin: string | null
          proxy_function_id: string
          requested_at: string
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          error_type?: string | null
          id?: string
          organization_id: string
          origin?: string | null
          proxy_function_id: string
          requested_at?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          error_type?: string | null
          id?: string
          organization_id?: string
          origin?: string | null
          proxy_function_id?: string
          requested_at?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proxy_invocation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_invocation_logs_proxy_function_id_fkey"
            columns: ["proxy_function_id"]
            isOneToOne: false
            referencedRelation: "proxy_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_invocations: {
        Row: {
          call_count: number
          created_at: string
          id: string
          last_called_at: string | null
          organization_id: string
          overage_reported: boolean
          overage_reported_at: string | null
          period: string
          proxy_function_id: string
          updated_at: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          id?: string
          last_called_at?: string | null
          organization_id: string
          overage_reported?: boolean
          overage_reported_at?: string | null
          period: string
          proxy_function_id: string
          updated_at?: string
        }
        Update: {
          call_count?: number
          created_at?: string
          id?: string
          last_called_at?: string | null
          organization_id?: string
          overage_reported?: boolean
          overage_reported_at?: string | null
          period?: string
          proxy_function_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_invocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_invocations_proxy_function_id_fkey"
            columns: ["proxy_function_id"]
            isOneToOne: false
            referencedRelation: "proxy_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_rate_limits: {
        Row: {
          id: string
          proxy_function_id: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          id?: string
          proxy_function_id: string
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          id?: string
          proxy_function_id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_rate_limits_proxy_function_id_fkey"
            columns: ["proxy_function_id"]
            isOneToOne: false
            referencedRelation: "proxy_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          http_method: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          pass_through_body: boolean
          request_body_template: Json | null
          secret_hints: Json
          slug: string
          sort_order: number
          target_headers: Json
          target_url: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          http_method?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          pass_through_body?: boolean
          request_body_template?: Json | null
          secret_hints?: Json
          slug: string
          sort_order?: number
          target_headers?: Json
          target_url: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          http_method?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pass_through_body?: boolean
          request_body_template?: Json | null
          secret_hints?: Json
          slug?: string
          sort_order?: number
          target_headers?: Json
          target_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      secret_view_log: {
        Row: {
          grant_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
          variable_id: string
          viewed_at: string
          viewed_by: string
        }
        Insert: {
          grant_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          variable_id: string
          viewed_at?: string
          viewed_by: string
        }
        Update: {
          grant_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          variable_id?: string
          viewed_at?: string
          viewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "secret_view_log_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "temporary_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_view_log_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "variables"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          project_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          project_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_secret_creates: {
        Row: {
          created_at: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          ip_hash?: string
        }
        Relationships: []
      }
      shared_secrets: {
        Row: {
          ciphertext: string
          created_at: string
          expires_at: string
          id: string
          iv: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          expires_at: string
          id?: string
          iv: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          expires_at?: string
          id?: string
          iv?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          billing_interval: string | null
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          features?: Json
          id: string
          is_active?: boolean
          limits?: Json
          name: string
          price_cents: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      temporary_access_grants: {
        Row: {
          access_duration_minutes: number | null
          access_expires_at: string | null
          created_at: string
          denial_reason: string | null
          environment_id: string
          id: string
          max_reveals: number
          organization_id: string
          request_reason: string
          requested_at: string
          requested_by: string
          reveal_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          variable_id: string
        }
        Insert: {
          access_duration_minutes?: number | null
          access_expires_at?: string | null
          created_at?: string
          denial_reason?: string | null
          environment_id: string
          id?: string
          max_reveals?: number
          organization_id: string
          request_reason: string
          requested_at?: string
          requested_by: string
          reveal_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          variable_id: string
        }
        Update: {
          access_duration_minutes?: number | null
          access_expires_at?: string | null
          created_at?: string
          denial_reason?: string | null
          environment_id?: string
          id?: string
          max_reveals?: number
          organization_id?: string
          request_reason?: string
          requested_at?: string
          requested_by?: string
          reveal_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          variable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_access_grants_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_access_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_access_grants_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "variables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      variable_access_log: {
        Row: {
          access_type: string
          accessed_at: string | null
          environment_id: string
          id: string
          metadata: Json | null
          organization_id: string
          user_id: string | null
          variable_id: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string | null
          environment_id: string
          id?: string
          metadata?: Json | null
          organization_id: string
          user_id?: string | null
          variable_id?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string | null
          environment_id?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          user_id?: string | null
          variable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variable_access_log_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_access_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_access_log_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "variables"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_audit_log: {
        Row: {
          action: string
          batch_id: string | null
          change_reason: string | null
          created_at: string
          environment_id: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          organization_id: string
          user_id: string
          variable_id: string | null
          variable_key: string | null
          version_number: number | null
        }
        Insert: {
          action: string
          batch_id?: string | null
          change_reason?: string | null
          created_at?: string
          environment_id: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          user_id: string
          variable_id?: string | null
          variable_key?: string | null
          version_number?: number | null
        }
        Update: {
          action?: string
          batch_id?: string | null
          change_reason?: string | null
          created_at?: string
          environment_id?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          user_id?: string
          variable_id?: string | null
          variable_key?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "variable_audit_log_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_audit_log_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "variables"
            referencedColumns: ["id"]
          },
        ]
      }
      variables: {
        Row: {
          created_at: string
          description: string | null
          environment_id: string
          fallback_value: string | null
          id: string
          is_secret: boolean
          key: string
          organization_id: string
          service_id: string | null
          sync_to_github: boolean
          tags: string[]
          updated_at: string
          updated_by: string | null
          value: string | null
          vault_secret_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          environment_id: string
          fallback_value?: string | null
          id?: string
          is_secret?: boolean
          key: string
          organization_id: string
          service_id?: string | null
          sync_to_github?: boolean
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          value?: string | null
          vault_secret_id?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          environment_id?: string
          fallback_value?: string | null
          id?: string
          is_secret?: boolean
          key?: string
          organization_id?: string
          service_id?: string | null
          sync_to_github?: boolean
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          value?: string | null
          vault_secret_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "variables_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variables_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      proxy_analytics_daily: {
        Row: {
          avg_response_time_ms: number | null
          client_error_count: number | null
          day: string | null
          organization_id: string | null
          p95_response_time_ms: number | null
          proxy_function_id: string | null
          server_error_count: number | null
          success_count: number | null
          total_calls: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proxy_invocation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_invocation_logs_proxy_function_id_fkey"
            columns: ["proxy_function_id"]
            isOneToOne: false
            referencedRelation: "proxy_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_analytics_hourly: {
        Row: {
          avg_response_time_ms: number | null
          error_count: number | null
          hour: string | null
          organization_id: string | null
          proxy_function_id: string | null
          success_count: number | null
          total_calls: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proxy_invocation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_invocation_logs_proxy_function_id_fkey"
            columns: ["proxy_function_id"]
            isOneToOne: false
            referencedRelation: "proxy_functions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      add_member_by_email: {
        Args: { member_role?: string; org_id: string; target_email: string }
        Returns: boolean
      }
      admin_delete_organization: { Args: { p_org_id: string }; Returns: string }
      apply_pending_change: { Args: { p_change_id: string }; Returns: boolean }
      approve_pending_change: {
        Args: { p_change_id: string }
        Returns: boolean
      }
      bulk_insert_variables: {
        Args: {
          environment_id_param: string
          import_as_secrets?: boolean
          organization_id_param: string
          service_id_param?: string
          variables_data: Json
        }
        Returns: {
          created_at: string
          description: string | null
          environment_id: string
          fallback_value: string | null
          id: string
          is_secret: boolean
          key: string
          organization_id: string
          service_id: string | null
          sync_to_github: boolean
          tags: string[]
          updated_at: string
          updated_by: string | null
          value: string | null
          vault_secret_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "variables"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      bulk_update_variables: {
        Args: { p_reason?: string; p_updates: Json }
        Returns: Json
      }
      can_approve_pending_change: {
        Args: { p_change_id: string }
        Returns: boolean
      }
      can_see_environment_values: { Args: { env_id: string }; Returns: boolean }
      cancel_invitation: { Args: { p_invitation_id: string }; Returns: boolean }
      check_account_lock: {
        Args: { target_email: string }
        Returns: {
          attempts_remaining: number
          is_locked: boolean
          locked_until: string
        }[]
      }
      check_and_increment_rate_limit: {
        Args: { p_proxy_function_id: string; p_rate_limit: number }
        Returns: Json
      }
      check_mfa_recovery_bypass: { Args: never; Returns: boolean }
      check_user_for_invitation: {
        Args: { org_id: string; target_email: string }
        Returns: {
          already_member: boolean
          user_exists: boolean
        }[]
      }
      cleanup_old_pending_syncs: { Args: never; Returns: number }
      cleanup_platform_sync_queue: { Args: never; Returns: number }
      compare_snapshot_to_current: {
        Args: { p_snapshot_id: string }
        Returns: Json
      }
      consume_shared_secret: {
        Args: { p_id: string }
        Returns: {
          ciphertext: string
          iv: string
        }[]
      }
      create_api_key: {
        Args: {
          p_expires_in_days?: number
          p_name: string
          p_organization_id: string
        }
        Returns: Json
      }
      create_cli_session_key: { Args: never; Returns: Json }
      create_environment_snapshot: {
        Args: {
          p_description?: string
          p_environment_id: string
          p_name: string
        }
        Returns: string
      }
      create_invitation: {
        Args: { p_email: string; p_organization_id: string; p_role: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          canceled_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_with_owner: {
        Args: { org_name: string }
        Returns: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }[]
      }
      create_platform_integration: {
        Args: {
          p_api_token: string
          p_ca_cert?: string
          p_instance_url?: string
          p_metadata?: Json
          p_name: string
          p_organization_id: string
          p_platform: string
          p_skip_ssl_verify?: boolean
        }
        Returns: string
      }
      create_shared_secret: {
        Args: { p_ciphertext: string; p_iv: string; p_ttl_seconds?: number }
        Returns: string
      }
      decrypt_variable_value: { Args: { variable_id: string }; Returns: string }
      delete_user_account: { Args: never; Returns: Json }
      deny_access: {
        Args: { p_grant_id: string; p_reason?: string }
        Returns: boolean
      }
      disable_github_for_project: {
        Args: { p_installation_id: string; p_project_id: string }
        Returns: undefined
      }
      downgrade_expired_trials: { Args: never; Returns: undefined }
      enable_github_for_project: {
        Args: { p_installation_id: string; p_project_id: string }
        Returns: {
          auto_sync: boolean
          created_at: string
          id: string
          installation_id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          project_id: string
          sync_mode: string
          sync_secrets: boolean
          sync_variables: boolean
          updated_at: string
          variable_storage_mode: string
        }
        SetofOptions: {
          from: "*"
          to: "github_project_sync_configs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_old_grants: { Args: never; Returns: number }
      expire_pending_changes: { Args: never; Returns: number }
      export_user_data: { Args: never; Returns: Json }
      generate_recovery_codes: { Args: never; Returns: string[] }
      get_activity_log: {
        Args: {
          p_action?: string
          p_date_from?: string
          p_date_to?: string
          p_environment_id?: string
          p_limit?: number
          p_offset?: number
          p_organization_id: string
          p_project_id?: string
        }
        Returns: {
          action: string
          created_at: string
          environment_id: string
          environment_name: string
          file_name: string
          id: string
          new_value: string
          old_value: string
          project_id: string
          project_name: string
          total_count: number
          type: string
          user_email: string
          variable_key: string
          variables_imported: number
          variables_overwritten: number
          variables_skipped: number
        }[]
      }
      get_due_lifecycle_emails: {
        Args: never
        Returns: {
          email: string
          email_type: string
          user_id: string
        }[]
      }
      get_environment_access_summary: {
        Args: { p_days?: number; p_environment_id: string }
        Returns: {
          last_accessed: string
          total_accesses: number
          variable_id: string
        }[]
      }
      get_environment_schema: {
        Args: { p_environment_id: string }
        Returns: Json
      }
      get_environment_sync_configs: {
        Args: { p_environment_id: string }
        Returns: {
          auto_sync: boolean
          created_at: string | null
          created_by: string | null
          environment_id: string
          github_environment: string | null
          id: string
          installation_id: string
          last_sync_count: number | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          repo_name: string | null
          repo_owner: string | null
          sync_level: string
          sync_mode: string
          sync_secrets: boolean
          sync_variables: boolean
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "github_sync_configs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_github_installation: {
        Args: { p_organization_id: string }
        Returns: {
          account_id: number
          account_login: string
          account_type: string
          created_at: string | null
          id: string
          installation_id: number
          installed_at: string | null
          installed_by: string | null
          organization_id: string
          permissions: Json | null
          repository_selection: string | null
          suspended_at: string | null
          uninstalled_at: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "github_installations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_github_installations: {
        Args: { p_organization_id: string }
        Returns: {
          account_id: number
          account_login: string
          account_type: string
          created_at: string | null
          id: string
          installation_id: number
          installed_at: string | null
          installed_by: string | null
          organization_id: string
          permissions: Json | null
          repository_selection: string | null
          suspended_at: string | null
          uninstalled_at: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "github_installations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_github_project_sync_config: {
        Args: { p_project_id: string }
        Returns: {
          auto_sync: boolean
          created_at: string
          id: string
          installation_id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          project_id: string
          sync_mode: string
          sync_secrets: boolean
          sync_variables: boolean
          updated_at: string
          variable_storage_mode: string
        }[]
        SetofOptions: {
          from: "*"
          to: "github_project_sync_configs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_newsletter_stats: { Args: never; Returns: Json }
      get_organization_limits: { Args: { org_id: string }; Returns: Json }
      get_organization_members_with_emails: {
        Args: { org_id: string }
        Returns: {
          created_at: string
          email: string
          environment_access_count: number
          id: string
          role: string
          user_id: string
        }[]
      }
      get_organization_subscription: {
        Args: { org_id: string }
        Returns: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          organization_id: string
          plan_id: string
          proxy_metered_item_id: string | null
          scheduled_change_date: string | null
          scheduled_plan_change_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_pending_access_requests_count: {
        Args: { p_org_id: string }
        Returns: number
      }
      get_pending_github_syncs: {
        Args: { p_limit?: number }
        Returns: {
          env_config_id: string
          environment_id: string
          installation_id: string
          pending_sync_id: string
          trigger_reason: string
        }[]
      }
      get_pending_invitations: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_email: string
          role: string
        }[]
      }
      get_pending_platform_syncs: {
        Args: { p_limit?: number }
        Returns: {
          change_type: string
          platform: string
          queue_id: string
          queued_at: string
          service_id: string
          sync_config_id: string
          variable_key: string
        }[]
      }
      get_platform_organization_activity: {
        Args: never
        Returns: {
          env_var_count: number
          last_sign_in_at: string
          organization_id: string
        }[]
      }
      get_platform_organization_counts: {
        Args: { org_id: string }
        Returns: {
          environments_count: number
          projects_count: number
          variables_count: number
        }[]
      }
      get_platform_stats: { Args: never; Returns: Json }
      get_proxy_overage: {
        Args: {
          p_included_limit: number
          p_organization_id: string
          p_period: string
        }
        Returns: Json
      }
      get_remaining_recovery_codes_count: { Args: never; Returns: number }
      get_user_environment_access: {
        Args: { org_id: string; target_user_id: string }
        Returns: {
          environment_id: string
        }[]
      }
      get_user_environment_ids: { Args: never; Returns: string[] }
      get_user_organization_ids: { Args: never; Returns: string[] }
      get_variable_access_stats: {
        Args: { p_days?: number; p_variable_id: string }
        Returns: {
          access_count: number
          access_type: string
          last_access: string
          unique_users: number
        }[]
      }
      get_variable_history: {
        Args: { p_limit?: number; p_offset?: number; p_variable_id: string }
        Returns: {
          action: string
          batch_id: string
          change_reason: string
          created_at: string
          id: string
          metadata: Json
          new_value: string
          old_value: string
          user_email: string
          user_id: string
          variable_key: string
          version_number: number
        }[]
      }
      get_variables_for_sync: {
        Args: {
          p_environment_id: string
          p_include_fallbacks?: boolean
          p_service_id?: string
          p_sync_secrets?: boolean
          p_sync_variables?: boolean
        }
        Returns: {
          fallback_value: string
          id: string
          is_secret: boolean
          key: string
          service_id: string
          tags: string[]
          value: string
        }[]
      }
      get_variables_to_sync: {
        Args: { p_environment_id: string; p_sync_mode?: string }
        Returns: {
          id: string
          is_secret: boolean
          key: string
          value: string
        }[]
      }
      get_vault_secret: { Args: { secret_id: string }; Returns: string }
      grant_access: {
        Args: { p_duration_minutes?: number; p_grant_id: string }
        Returns: boolean
      }
      has_active_subscription: { Args: { org_id: string }; Returns: boolean }
      has_environment_read_access: {
        Args: { env_id: string }
        Returns: boolean
      }
      has_environment_write_access: {
        Args: { env_id: string }
        Returns: boolean
      }
      has_temporary_access: {
        Args: { p_variable_id: string }
        Returns: boolean
      }
      increment_proxy_invocation:
        | {
            Args: {
              p_monthly_limit: number
              p_organization_id: string
              p_proxy_function_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_hard_cap?: number
              p_monthly_limit: number
              p_organization_id: string
              p_proxy_function_id: string
            }
            Returns: string
          }
      is_environment_protected: {
        Args: { p_environment_id: string }
        Returns: boolean
      }
      is_first_user: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      list_api_keys: {
        Args: { p_organization_id?: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          key_prefix: string
          last_used_at: string
          name: string
          organization_id: string
        }[]
      }
      log_auth_event: {
        Args: {
          p_email?: string
          p_event_type: string
          p_metadata?: Json
          p_success: boolean
        }
        Returns: undefined
      }
      log_variable_access: {
        Args: {
          p_access_type: string
          p_environment_id: string
          p_metadata?: Json
        }
        Returns: number
      }
      mark_platform_sync_processed: {
        Args: { p_queue_id: string }
        Returns: undefined
      }
      mark_sync_completed: {
        Args: { p_pending_sync_id: string }
        Returns: undefined
      }
      mark_sync_failed: {
        Args: { p_error: string; p_pending_sync_id: string }
        Returns: undefined
      }
      mark_sync_processing: {
        Args: { p_pending_sync_id: string }
        Returns: undefined
      }
      record_github_sync: {
        Args: {
          p_details?: Json
          p_error_message?: string
          p_secrets_synced: number
          p_status: string
          p_sync_config_id: string
          p_trigger_type: string
          p_triggered_by: string
          p_variables_synced: number
        }
        Returns: {
          completed_at: string | null
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          env_config_id: string | null
          error_message: string | null
          id: string
          secrets_synced: number
          started_at: string | null
          status: string
          sync_config_id: string | null
          trigger_type: string
          triggered_by: string | null
          variables_synced: number
        }
        SetofOptions: {
          from: "*"
          to: "github_sync_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_github_sync_v11: {
        Args: {
          p_details?: Json
          p_env_config_id: string
          p_error_message?: string
          p_secrets_synced: number
          p_status: string
          p_trigger_type: string
          p_triggered_by: string
          p_variables_synced: number
        }
        Returns: {
          completed_at: string | null
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          env_config_id: string | null
          error_message: string | null
          id: string
          secrets_synced: number
          started_at: string | null
          status: string
          sync_config_id: string | null
          trigger_type: string
          triggered_by: string | null
          variables_synced: number
        }
        SetofOptions: {
          from: "*"
          to: "github_sync_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_login_attempt: {
        Args: {
          attempt_ip: unknown
          target_email: string
          was_successful: boolean
        }
        Returns: undefined
      }
      record_platform_sync: {
        Args: {
          p_details?: Json
          p_error_message?: string
          p_secrets_synced: number
          p_status: string
          p_sync_config_id: string
          p_trigger_type: string
          p_triggered_by: string
          p_variables_synced: number
        }
        Returns: {
          created_at: string
          details: Json | null
          env_config_id: string
          error_message: string | null
          id: string
          secrets_synced: number
          status: string
          trigger_type: string
          triggered_by: string
          variables_synced: number
        }
        SetofOptions: {
          from: "*"
          to: "platform_sync_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_pending_change: {
        Args: { p_change_id: string; p_reason?: string }
        Returns: boolean
      }
      request_secret_access: {
        Args: { p_reason: string; p_variable_id: string }
        Returns: string
      }
      resend_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          canceled_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_environment_snapshot: {
        Args: { p_reason?: string; p_snapshot_id: string }
        Returns: Json
      }
      reveal_secret_value: {
        Args: {
          p_ip_address?: unknown
          p_user_agent?: string
          p_variable_id: string
        }
        Returns: string
      }
      revoke_api_key: { Args: { p_key_id: string }; Returns: boolean }
      rollback_variable: {
        Args: {
          p_reason?: string
          p_target_version: number
          p_variable_id: string
        }
        Returns: Json
      }
      save_environment_schema: {
        Args: { p_environment_id: string; p_schema_json: Json }
        Returns: {
          created_at: string
          created_by: string
          environment_id: string
          id: string
          organization_id: string
          schema_json: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "environment_schemas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_pending_change: {
        Args: {
          p_action: string
          p_comment?: string
          p_environment_id: string
          p_is_secret?: boolean
          p_key?: string
          p_value?: string
          p_variable_id?: string
        }
        Returns: string
      }
      subscribe_to_newsletter: {
        Args: { p_email: string; p_ip_address?: unknown; p_source?: string }
        Returns: Json
      }
      update_github_synced_keys: {
        Args: { p_env_config_id: string; p_synced_keys: string[] }
        Returns: string[]
      }
      update_synced_keys: {
        Args: { p_sync_config_id: string; p_synced_keys: string[] }
        Returns: string[]
      }
      update_user_environment_access:
        | {
            Args: {
              p_environment_ids: string[]
              p_granted_by: string
              p_organization_id: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_access_levels?: Json
              p_environment_ids: string[]
              p_granted_by: string
              p_organization_id: string
              p_user_id: string
            }
            Returns: undefined
          }
      validate_api_key: { Args: { p_api_key: string }; Returns: string }
      verify_recovery_code: { Args: { input_code: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
