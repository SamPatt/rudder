export interface Value {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

export interface Goal {
  id: string;
  value_id: string;
  name: string;
  target_by?: string;
  created_at: string;
  user_id: string;
  value?: Value;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  
  // Scheduling fields
  start_time?: string | null;
  end_time?: string | null;
  recur?: 'once' | 'daily' | 'weekdays' | 'custom' | null;
  custom_days?: number[] | null;
  event_date?: string | null;
  
  // Completion tracking
  is_done: boolean;
  completion_status?: 'completed' | 'skipped' | 'failed' | null;
  
  // Relationships
  goal_id?: string | null;
  
  // Metadata
  date: string;
  created_at: string;
  completed_at?: string | null;
  user_id: string;
  
  // Relationships (for queries)
  goal?: Goal;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      values: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "values_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      goals: {
        Row: {
          id: string;
          name: string;
          value_id: string;
          target_by?: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          value_id: string;
          target_by?: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          value_id?: string;
          target_by?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_value_id_fkey";
            columns: ["value_id"];
            isOneToOne: false;
            referencedRelation: "values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_time: string | null;
          end_time: string | null;
          recur: 'once' | 'daily' | 'weekdays' | 'custom' | null;
          custom_days: number[] | null;
          event_date: string | null;
          is_done: boolean;
          completion_status: 'completed' | 'skipped' | 'failed' | null;
          goal_id: string | null;
          date: string;
          created_at: string;
          completed_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          recur?: 'once' | 'daily' | 'weekdays' | 'custom' | null;
          custom_days?: number[] | null;
          event_date?: string | null;
          is_done?: boolean;
          completion_status?: 'completed' | 'skipped' | 'failed' | null;
          goal_id?: string | null;
          date: string;
          created_at?: string;
          completed_at?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          recur?: 'once' | 'daily' | 'weekdays' | 'custom' | null;
          custom_days?: number[] | null;
          event_date?: string | null;
          is_done?: boolean;
          completion_status?: 'completed' | 'skipped' | 'failed' | null;
          goal_id?: string | null;
          date?: string;
          created_at?: string;
          completed_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
} 