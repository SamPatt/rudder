export interface Value {
  id: string;
  name: string;
  created_at: string;
}

export interface Goal {
  id: string;
  value_id: string;
  name: string;
  target_by?: string;
  created_at: string;
  value?: Value;
}

export interface TaskGoal {
  id: string;
  task_id: string;
  goal_id: string;
  created_at: string;
  goal?: Goal;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  is_done: boolean;
  is_recurring?: boolean;
  recur_type?: 'daily' | 'weekdays' | 'weekly' | 'custom' | null;
  custom_days?: number[] | null;
  created_at: string;
  task_goals?: TaskGoal[];
}

export interface TimeBlock {
  id: string;
  goal_id?: string;
  title: string;
  start_hour: number;
  duration_m: number;
  recur: 'daily' | 'weekdays' | 'weekly';
  created_at: string;
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
        Row: Value;
        Insert: Omit<Value, 'id' | 'created_at'>;
        Update: Partial<Omit<Value, 'id' | 'created_at'>>;
      };
      goals: {
        Row: {
          id: string;
          name: string;
          value_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          value_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          value_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_value_id_fkey";
            columns: ["value_id"];
            isOneToOne: false;
            referencedRelation: "values";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          is_done: boolean;
          is_recurring: boolean;
          recur_type: string | null;
          custom_days: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          is_done?: boolean;
          is_recurring?: boolean;
          recur_type?: string | null;
          custom_days?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          is_done?: boolean;
          is_recurring?: boolean;
          recur_type?: string | null;
          custom_days?: number[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task_goals: {
        Row: {
          id: string;
          task_id: string;
          goal_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          goal_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          goal_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_goals_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_goals_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      time_blocks: {
        Row: {
          id: string;
          title: string;
          start_time: string;
          end_time: string;
          recur: string;
          custom_days: number[] | null;
          event_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          start_time: string;
          end_time: string;
          recur: string;
          custom_days?: number[] | null;
          event_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          start_time?: string;
          end_time?: string;
          recur?: string;
          custom_days?: number[] | null;
          event_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      schedule_completions: {
        Row: {
          id: string;
          time_block_id: string;
          date: string;
          status: 'completed' | 'skipped' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          time_block_id: string;
          date: string;
          status: 'completed' | 'skipped' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          time_block_id?: string;
          date?: string;
          status?: 'completed' | 'skipped' | 'failed';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_completions_time_block_id_fkey";
            columns: ["time_block_id"];
            isOneToOne: false;
            referencedRelation: "time_blocks";
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