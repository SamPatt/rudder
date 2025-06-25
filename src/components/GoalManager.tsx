import { useState } from 'react';
import { Goal, Value } from '../types/database';
import { supabase } from '../lib/supabase';

interface GoalManagerProps {
  goals: Goal[];
  values: Value[];
  setGoals: (goals: Goal[]) => void;
  setValues: (values: Value[]) => void;
}

export default function GoalManager({ goals, values, setGoals, setValues }: GoalManagerProps) {
  const [newValue, setNewValue] = useState('');
  const [newGoal, setNewGoal] = useState({
    name: '',
    value_id: '',
    target_by: ''
  });

  const addValue = async () => {
    if (!newValue.trim()) return;

    try {
      const { data, error } = await supabase
        .from('values')
        .insert({ name: newValue })
        .select()
        .single();

      if (error) throw error;

      setValues([data, ...values]);
      setNewValue('');
    } catch (error) {
      console.error('Error adding value:', error);
    }
  };

  const addGoal = async () => {
    if (!newGoal.name.trim() || !newGoal.value_id) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          name: newGoal.name,
          value_id: newGoal.value_id,
          target_by: newGoal.target_by || null
        })
        .select()
        .single();

      if (error) throw error;

      setGoals([data, ...goals]);
      setNewGoal({ name: '', value_id: '', target_by: '' });
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const deleteValue = async (id: string) => {
    try {
      const { error } = await supabase
        .from('values')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setValues(values.filter(value => value.id !== id));
    } catch (error) {
      console.error('Error deleting value:', error);
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGoals(goals.filter(goal => goal.id !== id));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const goalsByValue = values.map(value => ({
    value,
    goals: goals.filter(goal => goal.value_id === value.id)
  }));

  return (
    <div className="space-y-6">
      {/* Add New Value */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Add New Value</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter a value (e.g., Health, Learning, Relationships)..."
            className="flex-1 px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500 bg-slate-700 text-slate-200"
            onKeyPress={(e) => e.key === 'Enter' && addValue()}
          />
          <button
            onClick={addValue}
            className="bg-forest-600 text-white px-4 py-2 rounded-md hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors"
          >
            Add Value
          </button>
        </div>
      </div>

      {/* Add New Goal */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Add New Goal</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            value={newGoal.name}
            onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
            placeholder="Goal name..."
            className="px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500 bg-slate-700 text-slate-200"
          />
          <select
            value={newGoal.value_id}
            onChange={(e) => setNewGoal({ ...newGoal, value_id: e.target.value })}
            className="px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500 bg-slate-700 text-slate-200"
          >
            <option value="">Select a value...</option>
            {values.map(value => (
              <option key={value.id} value={value.id}>{value.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={newGoal.target_by}
            onChange={(e) => setNewGoal({ ...newGoal, target_by: e.target.value })}
            className="px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500 bg-slate-700 text-slate-200"
          />
        </div>
        <div className="mt-4">
          <button
            onClick={addGoal}
            className="bg-forest-600 text-white px-4 py-2 rounded-md hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors"
          >
            Add Goal
          </button>
        </div>
      </div>

      {/* Values and Goals */}
      <div className="space-y-6">
        {goalsByValue.map(({ value, goals: valueGoals }) => (
          <div key={value.id} className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">{value.name}</h3>
              <button
                onClick={() => deleteValue(value.id)}
                className="text-red-400 hover:text-red-300 text-sm transition-colors"
              >
                Delete Value
              </button>
            </div>
            
            {valueGoals.length === 0 ? (
              <p className="text-slate-400">No goals for this value yet.</p>
            ) : (
              <div className="space-y-3">
                {valueGoals.map(goal => (
                  <div key={goal.id} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg bg-slate-700">
                    <div>
                      <h4 className="font-medium text-slate-200">{goal.name}</h4>
                      {goal.target_by && (
                        <p className="text-sm text-slate-400">
                          Target: {new Date(goal.target_by).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* All Goals Summary */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">All Goals</h2>
        {goals.length === 0 ? (
          <p className="text-slate-400">No goals yet. Add some above!</p>
        ) : (
          <div className="space-y-2">
            {goals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg bg-slate-700">
                <div>
                  <h4 className="font-medium text-slate-200">{goal.name}</h4>
                  <p className="text-sm text-slate-400">
                    Value: {goal.value?.name}
                    {goal.target_by && ` • Target: ${new Date(goal.target_by).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 