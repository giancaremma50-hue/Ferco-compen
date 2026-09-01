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
      application_answers: {
        Row: {
          answer_text: string | null
          application_id: string
          created_at: string
          id: string
          job_id: string
          job_question_id: string
          organization_id: string
          selected_option_id: string | null
        }
        Insert: {
          answer_text?: string | null
          application_id: string
          created_at?: string
          id?: string
          job_id: string
          job_question_id: string
          organization_id: string
          selected_option_id?: string | null
        }
        Update: {
          answer_text?: string | null
          application_id?: string
          created_at?: string
          id?: string
          job_id?: string
          job_question_id?: string
          organization_id?: string
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_job_question_id_fkey"
            columns: ["job_question_id"]
            isOneToOne: false
            referencedRelation: "job_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "job_question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      application_competency_scores: {
        Row: {
          application_id: string
          comment: string | null
          competency_id: string
          created_at: string
          evaluator_id: string
          id: string
          organization_id: string
          score: number
          updated_at: string
        }
        Insert: {
          application_id: string
          comment?: string | null
          competency_id: string
          created_at?: string
          evaluator_id: string
          id?: string
          organization_id: string
          score: number
          updated_at?: string
        }
        Update: {
          application_id?: string
          comment?: string | null
          competency_id?: string
          created_at?: string
          evaluator_id?: string
          id?: string
          organization_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_competency_scores_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_competency_scores_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "job_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_competency_scores_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_competency_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          id: string
          organization_id: string
          payload: Json
          type: Database["public"]["Enums"]["application_event_type"]
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json
          type: Database["public"]["Enums"]["application_event_type"]
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["application_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "application_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string
          candidate_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          organization_id: string
          prequalified: boolean | null
          rating: number | null
          rejection_reason_id: string | null
          stage_changed_at: string
          stage_changed_by: string | null
          stage_id: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          applied_at?: string
          candidate_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          prequalified?: boolean | null
          rating?: number | null
          rejection_reason_id?: string | null
          stage_changed_at?: string
          stage_changed_by?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          applied_at?: string
          candidate_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          prequalified?: boolean | null
          rating?: number | null
          rejection_reason_id?: string | null
          stage_changed_at?: string
          stage_changed_by?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_rejection_reason_id_fkey"
            columns: ["rejection_reason_id"]
            isOneToOne: false
            referencedRelation: "rejection_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_stage_changed_by_fkey"
            columns: ["stage_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          application_id: string | null
          candidate_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          kind: string
          organization_id: string
          uploaded_by: string | null
        }
        Insert: {
          application_id?: string | null
          candidate_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          kind?: string
          organization_id: string
          uploaded_by?: string | null
        }
        Update: {
          application_id?: string | null
          candidate_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          kind?: string
          organization_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_segments: {
        Row: {
          created_at: string
          created_by: string
          filters: Json
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          filters?: Json
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          filters?: Json
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_segments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tasks: {
        Row: {
          application_id: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_done: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_done?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_done?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          created_by: string | null
          current_company: string | null
          current_title: string | null
          cv_file_path: string | null
          cv_parsed: Json | null
          email: string
          full_name: string
          id: string
          linkedin_url: string | null
          organization_id: string
          phone: string | null
          referred_by: string | null
          skills: string[]
          source: Database["public"]["Enums"]["candidate_source"]
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_title?: string | null
          cv_file_path?: string | null
          cv_parsed?: Json | null
          email: string
          full_name: string
          id?: string
          linkedin_url?: string | null
          organization_id: string
          phone?: string | null
          referred_by?: string | null
          skills?: string[]
          source?: Database["public"]["Enums"]["candidate_source"]
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_title?: string | null
          cv_file_path?: string | null
          cv_parsed?: Json | null
          email?: string
          full_name?: string
          id?: string
          linkedin_url?: string | null
          organization_id?: string
          phone?: string | null
          referred_by?: string | null
          skills?: string[]
          source?: Database["public"]["Enums"]["candidate_source"]
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          country: string | null
          created_at: string
          head_profile_id: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          head_profile_id?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          head_profile_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_profile_id_fkey"
            columns: ["head_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          id: string
          is_active: boolean
          key: string
          organization_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          id?: string
          is_active?: boolean
          key: string
          organization_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          id?: string
          is_active?: boolean
          key?: string
          organization_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_reasons: {
        Row: {
          created_at: string
          id: string
          label: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_report_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          error_report_id: string
          id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          error_report_id: string
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          error_report_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_report_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_report_messages_error_report_id_fkey"
            columns: ["error_report_id"]
            isOneToOne: false
            referencedRelation: "error_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_report_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          assigned_to: string | null
          code: string
          context: Json
          created_at: string
          fingerprint: string | null
          id: string
          organization_id: string
          reporter_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["error_severity"]
          stack: string | null
          status: Database["public"]["Enums"]["error_status"]
          technical_detail: string | null
          title: string
          updated_at: string
          url: string | null
          user_agent: string | null
          user_message: string
        }
        Insert: {
          assigned_to?: string | null
          code?: string
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          organization_id: string
          reporter_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          stack?: string | null
          status?: Database["public"]["Enums"]["error_status"]
          technical_detail?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          user_message?: string
        }
        Update: {
          assigned_to?: string | null
          code?: string
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          organization_id?: string
          reporter_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          stack?: string | null
          status?: Database["public"]["Enums"]["error_status"]
          technical_detail?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          application_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          id: string
          interviewer_id: string
          location: string | null
          notes: string | null
          organization_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          id?: string
          interviewer_id: string
          location?: string | null
          notes?: string | null
          organization_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_collaborators: {
        Row: {
          created_at: string
          id: string
          job_id: string
          organization_id: string
          permission: Database["public"]["Enums"]["job_collaborator_permission"]
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          permission?: Database["public"]["Enums"]["job_collaborator_permission"]
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["job_collaborator_permission"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_collaborators_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_collaborators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_collaborators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_competencies: {
        Row: {
          created_at: string
          id: string
          job_id: string
          name: string
          organization_id: string
          position: number
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          name: string
          organization_id: string
          position?: number
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          organization_id?: string
          position?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_competencies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_competencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_question_options: {
        Row: {
          created_at: string
          id: string
          is_expected: boolean
          job_id: string
          label: string
          organization_id: string
          position: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_expected?: boolean
          job_id: string
          label: string
          organization_id: string
          position?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_expected?: boolean
          job_id?: string
          label?: string
          organization_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_question_options_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_question_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "job_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_questions: {
        Row: {
          created_at: string
          id: string
          job_id: string
          organization_id: string
          position: number
          prompt: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          position?: number
          prompt: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          position?: number
          prompt?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stages: {
        Row: {
          created_at: string
          id: string
          job_id: string
          name: string
          organization_id: string
          position: number
          type: Database["public"]["Enums"]["job_stage_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          name: string
          organization_id: string
          position: number
          type: Database["public"]["Enums"]["job_stage_type"]
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          organization_id?: string
          position?: number
          type?: Database["public"]["Enums"]["job_stage_type"]
        }
        Relationships: [
          {
            foreignKeyName: "job_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_template_question_options: {
        Row: {
          created_at: string
          id: string
          is_expected: boolean
          job_template_id: string
          label: string
          organization_id: string
          position: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_expected?: boolean
          job_template_id: string
          label: string
          organization_id: string
          position?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_expected?: boolean
          job_template_id?: string
          label?: string
          organization_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_template_question_options_job_template_id_fkey"
            columns: ["job_template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_template_question_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_template_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "job_template_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_template_questions: {
        Row: {
          created_at: string
          id: string
          job_template_id: string
          organization_id: string
          position: number
          prompt: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_template_id: string
          organization_id: string
          position?: number
          prompt: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          job_template_id?: string
          organization_id?: string
          position?: number
          prompt?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_template_questions_job_template_id_fkey"
            columns: ["job_template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_template_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_template_stages: {
        Row: {
          created_at: string
          id: string
          job_template_id: string
          kind: string
          organization_id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_template_id: string
          kind?: string
          organization_id: string
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          job_template_id?: string
          kind?: string
          organization_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_template_stages_job_template_id_fkey"
            columns: ["job_template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_template_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_templates: {
        Row: {
          candidacy_fields: Json
          competencies: Json
          country: string
          created_at: string
          created_by: string
          description: string
          employment_type: string
          id: string
          is_confidential: boolean
          is_public: boolean
          location: string
          name: string
          organization_id: string
          pipeline_template_id: string | null
          requirements: string
          status: string
          title: string
          updated_at: string
          work_mode: string
        }
        Insert: {
          candidacy_fields?: Json
          competencies?: Json
          country: string
          created_at?: string
          created_by?: string
          description: string
          employment_type: string
          id?: string
          is_confidential?: boolean
          is_public?: boolean
          location: string
          name: string
          organization_id: string
          pipeline_template_id?: string | null
          requirements: string
          status?: string
          title: string
          updated_at?: string
          work_mode: string
        }
        Update: {
          candidacy_fields?: Json
          competencies?: Json
          country?: string
          created_at?: string
          created_by?: string
          description?: string
          employment_type?: string
          id?: string
          is_confidential?: boolean
          is_public?: boolean
          location?: string
          name?: string
          organization_id?: string
          pipeline_template_id?: string | null
          requirements?: string
          status?: string
          title?: string
          updated_at?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_templates_pipeline_template_id_fkey"
            columns: ["pipeline_template_id"]
            isOneToOne: false
            referencedRelation: "pipeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          candidacy_fields: Json
          code: string
          country: string | null
          created_at: string
          department_id: string | null
          description: string
          employment_reason_id: string | null
          employment_type: string | null
          headcount: number
          id: string
          is_public: boolean
          job_template_id: string | null
          location: string | null
          organization_id: string
          owner_id: string | null
          pipeline_template_id: string | null
          published_at: string | null
          requested_by: string | null
          requirements: string
          salary_max: number | null
          salary_min: number | null
          slug: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          vacancy_type: string | null
          work_mode: string | null
        }
        Insert: {
          candidacy_fields?: Json
          code?: string
          country?: string | null
          created_at?: string
          department_id?: string | null
          description?: string
          employment_reason_id?: string | null
          employment_type?: string | null
          headcount?: number
          id?: string
          is_public?: boolean
          job_template_id?: string | null
          location?: string | null
          organization_id: string
          owner_id?: string | null
          pipeline_template_id?: string | null
          published_at?: string | null
          requested_by?: string | null
          requirements?: string
          salary_max?: number | null
          salary_min?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          vacancy_type?: string | null
          work_mode?: string | null
        }
        Update: {
          candidacy_fields?: Json
          code?: string
          country?: string | null
          created_at?: string
          department_id?: string | null
          description?: string
          employment_reason_id?: string | null
          employment_type?: string | null
          headcount?: number
          id?: string
          is_public?: boolean
          job_template_id?: string | null
          location?: string | null
          organization_id?: string
          owner_id?: string | null
          pipeline_template_id?: string | null
          published_at?: string | null
          requested_by?: string | null
          requirements?: string
          salary_max?: number | null
          salary_min?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          vacancy_type?: string | null
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_employment_reason_id_fkey"
            columns: ["employment_reason_id"]
            isOneToOne: false
            referencedRelation: "employment_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_job_template_id_fkey"
            columns: ["job_template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_pipeline_template_id_fkey"
            columns: ["pipeline_template_id"]
            isOneToOne: false
            referencedRelation: "pipeline_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          organization_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          application_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          is_private: boolean
          mentions: string[]
          organization_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_private?: boolean
          mentions?: string[]
          organization_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_private?: boolean
          mentions?: string[]
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          id: string
          in_app: boolean
          organization_id: string
          profile_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          email?: boolean
          id?: string
          in_app?: boolean
          organization_id: string
          profile_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          email?: boolean
          id?: string
          in_app?: boolean
          organization_id?: string
          profile_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          email_sent_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          email_sent_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email_sent_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string
          allowed_email_domain: string | null
          careers_headline: string | null
          careers_intro: string | null
          created_at: string
          id: string
          login_image_url: string | null
          logo_dark_url: string | null
          logo_url: string | null
          name: string
          platform_name: string
          slug: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          allowed_email_domain?: string | null
          careers_headline?: string | null
          careers_intro?: string | null
          created_at?: string
          id?: string
          login_image_url?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          name: string
          platform_name?: string
          slug: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          allowed_email_domain?: string | null
          careers_headline?: string | null
          careers_intro?: string | null
          created_at?: string
          id?: string
          login_image_url?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          name?: string
          platform_name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_template_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          pipeline_template_id: string
          position: number
          type: Database["public"]["Enums"]["job_stage_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          pipeline_template_id: string
          position: number
          type: Database["public"]["Enums"]["job_stage_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          pipeline_template_id?: string
          position?: number
          type?: Database["public"]["Enums"]["job_stage_type"]
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_template_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_template_stages_pipeline_template_id_fkey"
            columns: ["pipeline_template_id"]
            isOneToOne: false
            referencedRelation: "pipeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          department_id: string | null
          display_name: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          department_id?: string | null
          display_name: string
          email: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rejection_reasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejection_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      app_role: "colaborador" | "gestor" | "admin" | "super_admin"
      application_event_type:
        | "postulacion_creada"
        | "etapa_cambiada"
        | "nota_agregada"
        | "correo_enviado"
        | "adjunto_agregado"
        | "calificacion_cambiada"
        | "rechazada"
      application_status: "activa" | "contratada" | "rechazada" | "retirada"
      candidate_source:
        | "portal"
        | "referido"
        | "carga_manual"
        | "busqueda_activa"
      error_severity: "baja" | "media" | "alta" | "critica"
      error_status:
        | "nuevo"
        | "en_revision"
        | "esperando_usuario"
        | "resuelto"
        | "descartado"
      interview_status: "programada" | "completada" | "cancelada"
      job_collaborator_permission:
        | "viewer"
        | "interviewer"
        | "approver"
        | "owner"
      job_stage_type:
        | "postulado"
        | "preseleccion"
        | "entrevista"
        | "oferta"
        | "contratado"
        | "descartado"
      job_status:
        | "borrador"
        | "pendiente_aprobacion"
        | "abierta"
        | "pausada"
        | "cerrada"
        | "cancelada"
      notification_type:
        | "nueva_postulacion"
        | "cambio_etapa"
        | "mencion_nota"
        | "vacante_pendiente_aprobacion"
        | "movimiento_referido"
        | "respuesta_reporte_error"
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
      app_role: ["colaborador", "gestor", "admin", "super_admin"],
      application_event_type: [
        "postulacion_creada",
        "etapa_cambiada",
        "nota_agregada",
        "correo_enviado",
        "adjunto_agregado",
        "calificacion_cambiada",
        "rechazada",
      ],
      application_status: ["activa", "contratada", "rechazada", "retirada"],
      candidate_source: [
        "portal",
        "referido",
        "carga_manual",
        "busqueda_activa",
      ],
      error_severity: ["baja", "media", "alta", "critica"],
      error_status: [
        "nuevo",
        "en_revision",
        "esperando_usuario",
        "resuelto",
        "descartado",
      ],
      interview_status: ["programada", "completada", "cancelada"],
      job_collaborator_permission: [
        "viewer",
        "interviewer",
        "approver",
        "owner",
      ],
      job_stage_type: [
        "postulado",
        "preseleccion",
        "entrevista",
        "oferta",
        "contratado",
        "descartado",
      ],
      job_status: [
        "borrador",
        "pendiente_aprobacion",
        "abierta",
        "pausada",
        "cerrada",
        "cancelada",
      ],
      notification_type: [
        "nueva_postulacion",
        "cambio_etapa",
        "mencion_nota",
        "vacante_pendiente_aprobacion",
        "movimiento_referido",
        "respuesta_reporte_error",
      ],
    },
  },
} as const
