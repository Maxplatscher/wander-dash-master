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
      company: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      depot: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          company_id: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          postal_code: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          postal_code?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          postal_code?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver: {
        Row: {
          company_id: string
          id: string
          name: string | null
          phone: string | null
          shift_end: string | null
          shift_start: string | null
          status: string | null
        }
        Insert: {
          company_id: string
          id?: string
          name?: string | null
          phone?: string | null
          shift_end?: string | null
          shift_start?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          name?: string | null
          phone?: string | null
          shift_end?: string | null
          shift_start?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          body_preview: string | null
          created_at: string
          error_detail: string | null
          from_addr: string | null
          id: string
          message_id: string | null
          processed_at: string | null
          shipment_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          error_detail?: string | null
          from_addr?: string | null
          id?: string
          message_id?: string | null
          processed_at?: string | null
          shipment_id?: string | null
          status: string
          subject?: string | null
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          error_detail?: string | null
          from_addr?: string | null
          id?: string
          message_id?: string | null
          processed_at?: string | null
          shipment_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_run: {
        Row: {
          company_id: string
          created_at: string
          id: string
          input_snapshot: Json | null
          result_snapshot: Json | null
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          input_snapshot?: Json | null
          result_snapshot?: Json | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          input_snapshot?: Json | null
          result_snapshot?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_run_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment: {
        Row: {
          company_id: string
          customer_name: string | null
          delivery_address: string | null
          demand: number | null
          email_notes: string | null
          email_processed_at: string | null
          email_received_at: string | null
          id: string
          intake_source: string | null
          intake_status: string | null
          location_x: number | null
          location_y: number | null
          missing_fields: Json | null
          name: string | null
          positionen: Json | null
          raw_email: string | null
          released_at: string | null
          released_by: string | null
          seller_email: string | null
          service_date: string | null
          weight_kg: number | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          company_id: string
          customer_name?: string | null
          delivery_address?: string | null
          demand?: number | null
          email_notes?: string | null
          email_processed_at?: string | null
          email_received_at?: string | null
          id?: string
          intake_source?: string | null
          intake_status?: string | null
          location_x?: number | null
          location_y?: number | null
          missing_fields?: Json | null
          name?: string | null
          positionen?: Json | null
          raw_email?: string | null
          released_at?: string | null
          released_by?: string | null
          seller_email?: string | null
          service_date?: string | null
          weight_kg?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          company_id?: string
          customer_name?: string | null
          delivery_address?: string | null
          demand?: number | null
          email_notes?: string | null
          email_processed_at?: string | null
          email_received_at?: string | null
          id?: string
          intake_source?: string | null
          intake_status?: string | null
          location_x?: number | null
          location_y?: number | null
          missing_fields?: Json | null
          name?: string | null
          positionen?: Json | null
          raw_email?: string | null
          released_at?: string | null
          released_by?: string | null
          seller_email?: string | null
          service_date?: string | null
          weight_kg?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      system_integrations: {
        Row: {
          company_id: string
          config: Json | null
          created_at: string
          depot_id: string | null
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_latency_ms: number | null
          last_test_message: string | null
          last_test_result: boolean | null
          name: string
          system_type: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          company_id: string
          config?: Json | null
          created_at?: string
          depot_id?: string | null
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_latency_ms?: number | null
          last_test_message?: string | null
          last_test_result?: boolean | null
          name: string
          system_type: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          company_id?: string
          config?: Json | null
          created_at?: string
          depot_id?: string | null
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_latency_ms?: number | null
          last_test_message?: string | null
          last_test_result?: boolean | null
          name?: string
          system_type?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_integrations_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depot"
            referencedColumns: ["id"]
          },
        ]
      }
      tour: {
        Row: {
          company_id: string
          created_at: string
          date: string | null
          description: string | null
          id: string
          is_active: boolean | null
          plan_run_id: string | null
          plan_version_id: string | null
          total_cost: number | null
          version: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          plan_run_id?: string | null
          plan_version_id?: string | null
          total_cost?: number | null
          version?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          plan_run_id?: string | null
          plan_version_id?: string | null
          total_cost?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_plan_run_id_fkey"
            columns: ["plan_run_id"]
            isOneToOne: false
            referencedRelation: "plan_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "touren_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_stop: {
        Row: {
          arrival_time: string | null
          departure_time: string | null
          driver_completed: boolean | null
          driver_completed_at: string | null
          id: string
          segment_cost: number | null
          shipment_id: string | null
          stop_index: number | null
          tour_id: string
          vehicle_id: string | null
        }
        Insert: {
          arrival_time?: string | null
          departure_time?: string | null
          driver_completed?: boolean | null
          driver_completed_at?: string | null
          id?: string
          segment_cost?: number | null
          shipment_id?: string | null
          stop_index?: number | null
          tour_id: string
          vehicle_id?: string | null
        }
        Update: {
          arrival_time?: string | null
          departure_time?: string | null
          driver_completed?: boolean | null
          driver_completed_at?: string | null
          id?: string
          segment_cost?: number | null
          shipment_id?: string | null
          stop_index?: number | null
          tour_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_stop_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_stop_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tour"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_stop_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle"
            referencedColumns: ["id"]
          },
        ]
      }
      touren_plan: {
        Row: {
          company_id: string
          created_at: string
          date: string | null
          description: string | null
          id: string
          is_active: boolean | null
          plan_run_id: string | null
          total_cost: number | null
          version: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          plan_run_id?: string | null
          total_cost?: number | null
          version?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          plan_run_id?: string | null
          total_cost?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "touren_plan_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touren_plan_plan_run_id_fkey"
            columns: ["plan_run_id"]
            isOneToOne: false
            referencedRelation: "plan_run"
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
      users: {
        Row: {
          company_id: string | null
          created_at: string
          driver_id: string | null
          email: string
          id: string
          is_active: boolean | null
          password_hash: string | null
          role: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          password_hash?: string | null
          role?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          password_hash?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle: {
        Row: {
          capacity: number | null
          company_id: string
          id: string
          name: string | null
        }
        Insert: {
          capacity?: number | null
          company_id: string
          id?: string
          name?: string | null
        }
        Update: {
          capacity?: number | null
          company_id?: string
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: { Args: never; Returns: string }
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      delete_integration_with_secret: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      upsert_integration: {
        Args: {
          p_company_id: string
          p_config: Json
          p_credentials: string
          p_depot_id: string | null
          p_id: string
          p_is_active: boolean
          p_name: string
          p_system_type: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "driver"
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
      app_role: ["admin", "dispatcher", "driver"],
    },
  },
} as const
