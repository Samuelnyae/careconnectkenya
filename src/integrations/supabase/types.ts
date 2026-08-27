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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          created_by: string | null
          doctor_id: string | null
          duration_minutes: number
          ended_at: string | null
          id: string
          notes: string | null
          patient_id: string
          reason: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
          video_provider: string | null
          video_room_name: string | null
          video_room_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          reason?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: string
          tenant_id: string
          type?: string
          updated_at?: string
          video_provider?: string | null
          video_room_name?: string | null
          video_room_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          video_provider?: string | null
          video_room_name?: string | null
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          memo: string | null
          posted: boolean
          reference: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          posted?: boolean
          reference?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          posted?: boolean
          reference?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          entry_id: string
          id: string
          memo: string | null
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          memo?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          memo?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          notes: string | null
          ordered_by: string | null
          patient_id: string
          performed_at: string
          reference_range: string | null
          result_unit: string | null
          result_value: string | null
          status: string
          tenant_id: string
          test_category: string | null
          test_name: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          ordered_by?: string | null
          patient_id: string
          performed_at?: string
          reference_range?: string | null
          result_unit?: string | null
          result_value?: string | null
          status?: string
          tenant_id: string
          test_category?: string | null
          test_name: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          ordered_by?: string | null
          patient_id?: string
          performed_at?: string
          reference_range?: string | null
          result_unit?: string | null
          result_value?: string | null
          status?: string
          tenant_id?: string
          test_category?: string | null
          test_name?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: []
      }
      medication_losses: {
        Row: {
          batch_number: string | null
          created_at: string
          id: string
          notes: string | null
          occurred_at: string
          product_id: string | null
          product_name: string
          quantity: number
          reason: string
          recorded_by: string | null
          tenant_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          product_id?: string | null
          product_name: string
          quantity: number
          reason: string
          recorded_by?: string | null
          tenant_id: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string
          recorded_by?: string | null
          tenant_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_visits: {
        Row: {
          attended_by: string | null
          county: string | null
          created_at: string
          diagnosis: string | null
          id: string
          notes: string | null
          patient_id: string
          reason: string | null
          tenant_id: string
          updated_at: string
          visit_date: string
          vitals: Json | null
        }
        Insert: {
          attended_by?: string | null
          county?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          reason?: string | null
          tenant_id: string
          updated_at?: string
          visit_date?: string
          vitals?: Json | null
        }
        Update: {
          attended_by?: string | null
          county?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string | null
          tenant_id?: string
          updated_at?: string
          visit_date?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          auth_user_id: string | null
          chronic_conditions: string | null
          chronic_review_date: string | null
          consent_at: string | null
          consent_given: boolean
          consent_method: string | null
          county: string | null
          created_at: string
          created_by: string | null
          data_retention_until: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          is_chronic: boolean
          national_id: string | null
          notes: string | null
          phone: string | null
          preferred_channels: string[]
          registered_via: string | null
          sha_number: string | null
          telegram_chat_id: string | null
          tenant_id: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          auth_user_id?: string | null
          chronic_conditions?: string | null
          chronic_review_date?: string | null
          consent_at?: string | null
          consent_given?: boolean
          consent_method?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          data_retention_until?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_chronic?: boolean
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          preferred_channels?: string[]
          registered_via?: string | null
          sha_number?: string | null
          telegram_chat_id?: string | null
          tenant_id: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          auth_user_id?: string | null
          chronic_conditions?: string | null
          chronic_review_date?: string | null
          consent_at?: string | null
          consent_given?: boolean
          consent_method?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          data_retention_until?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_chronic?: boolean
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          preferred_channels?: string[]
          registered_via?: string | null
          sha_number?: string | null
          telegram_chat_id?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
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
      prescription_deliveries: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          destination: string | null
          error_message: string | null
          id: string
          patient_id: string
          prescription_id: string
          sent_at: string | null
          share_expires_at: string | null
          share_token: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          error_message?: string | null
          id?: string
          patient_id: string
          prescription_id: string
          sent_at?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          error_message?: string | null
          id?: string
          patient_id?: string
          prescription_id?: string
          sent_at?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          created_at: string
          dispensed_at: string | null
          dispensed_by: string | null
          dosage: string | null
          drug_name: string
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          patient_id: string
          prescribed_by: string | null
          product_id: string | null
          quantity: number | null
          refills_remaining: number
          status: string
          tenant_id: string
          visit_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string | null
          dosage?: string | null
          drug_name: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          patient_id: string
          prescribed_by?: string | null
          product_id?: string | null
          quantity?: number | null
          refills_remaining?: number
          status?: string
          tenant_id: string
          visit_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string | null
          dosage?: string | null
          drug_name?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          patient_id?: string
          prescribed_by?: string | null
          product_id?: string | null
          quantity?: number | null
          refills_remaining?: number
          status?: string
          tenant_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string
          cost_price: number
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          received_at: string
          status: string
          storage_location: string | null
          supplier_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          batch_number: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          received_at?: string
          status?: string
          storage_location?: string | null
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          batch_number?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          received_at?: string
          status?: string
          storage_location?: string | null
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          batch_number: string | null
          category: string | null
          cost_price: number
          created_at: string
          dosage_form: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_controlled: boolean
          manufacturer: string | null
          name: string
          reorder_level: number
          sku: string | null
          stock_qty: number
          storage_location: string | null
          strength: string | null
          supplier: string | null
          supplier_id: string | null
          tenant_id: string
          unit_of_measure: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          batch_number?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          dosage_form?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_controlled?: boolean
          manufacturer?: string | null
          name: string
          reorder_level?: number
          sku?: string | null
          stock_qty?: number
          storage_location?: string | null
          strength?: string | null
          supplier?: string | null
          supplier_id?: string | null
          tenant_id: string
          unit_of_measure?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          batch_number?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          dosage_form?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_controlled?: boolean
          manufacturer?: string | null
          name?: string
          reorder_level?: number
          sku?: string | null
          stock_qty?: number
          storage_location?: string | null
          strength?: string | null
          supplier?: string | null
          supplier_id?: string | null
          tenant_id?: string
          unit_of_measure?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          po_id: string
          product_id: string | null
          product_name: string
          quantity: number
          received_qty: number
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          po_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          received_qty?: number
          tenant_id: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          po_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          received_qty?: number
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: string
          supplier_id: string | null
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string | null
          delivery_log: Json | null
          error_message: string | null
          id: string
          message: string
          patient_id: string
          related_id: string | null
          reminder_type: string
          scheduled_at: string
          sent_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          delivery_log?: Json | null
          error_message?: string | null
          id?: string
          message: string
          patient_id: string
          related_id?: string | null
          reminder_type: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          delivery_log?: Json | null
          error_message?: string | null
          id?: string
          message?: string
          patient_id?: string
          related_id?: string | null
          reminder_type?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rx_fraud_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          prescription_id: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          prescription_id?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          prescription_id?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string
          county: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          patient_id: string | null
          payment_method: string
          tenant_id: string
          total: number
        }
        Insert: {
          cashier_id: string
          county?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          patient_id?: string | null
          payment_method?: string
          tenant_id: string
          total?: number
        }
        Update: {
          cashier_id?: string
          county?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          patient_id?: string | null
          payment_method?: string
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_claims: {
        Row: {
          amount_approved: number | null
          amount_claimed: number
          claim_number: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          id: string
          notes: string | null
          patient_id: string
          rejection_reason: string | null
          response_date: string | null
          sale_id: string | null
          services_rendered: string | null
          status: string
          submission_date: string | null
          tenant_id: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          amount_approved?: number | null
          amount_claimed?: number
          claim_number?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          rejection_reason?: string | null
          response_date?: string | null
          sale_id?: string | null
          services_rendered?: string | null
          status?: string
          submission_date?: string | null
          tenant_id: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          amount_approved?: number | null
          amount_claimed?: number
          claim_number?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          rejection_reason?: string | null
          response_date?: string | null
          sale_id?: string | null
          services_rendered?: string | null
          status?: string
          submission_date?: string | null
          tenant_id?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sha_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claims_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claims_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "patient_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          location_from: string | null
          location_to: string | null
          movement_type: string
          notes: string | null
          occurred_at: string
          performed_by: string | null
          product_id: string
          quantity: number
          reason: string | null
          reference: string | null
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          location_from?: string | null
          location_to?: string | null
          movement_type: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          reference?: string | null
          tenant_id: string
          unit_cost?: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          location_from?: string | null
          location_to?: string | null
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          reference?: string | null
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_take_lines: {
        Row: {
          counted_qty: number | null
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          system_qty: number
          take_id: string
          tenant_id: string
        }
        Insert: {
          counted_qty?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          system_qty?: number
          take_id: string
          tenant_id: string
        }
        Update: {
          counted_qty?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          system_qty?: number
          take_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_take_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_take_lines_take_id_fkey"
            columns: ["take_id"]
            isOneToOne: false
            referencedRelation: "stock_takes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_take_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_takes: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          started_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_takes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          county: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          type: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          type?: string
        }
        Update: {
          county?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verify_cron_token: {
        Args: { _name: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "pharmacist"
        | "cashier"
        | "staff"
        | "super_admin"
        | "doctor"
        | "chv"
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
      app_role: [
        "owner",
        "admin",
        "pharmacist",
        "cashier",
        "staff",
        "super_admin",
        "doctor",
        "chv",
      ],
    },
  },
} as const
