import { useState } from 'react';
import { Goal, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import ConfirmationModal from './ConfirmationModal';
import { getValueIcon } from '../lib/valueIcons';

interface GoalManagerProps {
  goals: Goal[];
  values: Value[];
  setGoals: (goals: Goal[]) => void;
  setValues: (values: Value[]) => void;
  user: any;
}

export default function GoalManager({ goals, values, setGoals, setValues, user }: GoalManagerProps) {
  const [newValue, setNewValue] = useState('');
  const [newGoal, setNewGoal] = useState({
    name: '',
    value_id: '',
    target_by: ''
  });
  const [showDeleteValueModal, setShowDeleteValueModal] = useState(false);
  const [showDeleteGoalModal, setShowDeleteGoalModal] = useState(false);
  const [valueToDelete, setValueToDelete] = useState<string | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  const addValue = async () => {
    if (!newValue.trim()) return;

    try {
      const { data, error } = await supabase
        .from('values')
        .insert({ name: newValue, user_id: user.id })
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
          target_by: newGoal.target_by || null,
          user_id: user.id,
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
        .eq('id', id)
        .eq('user_id', user.id);

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
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setGoals(goals.filter(goal => goal.id !== id));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const confirmDeleteValue = async () => {
    if (valueToDelete) {
      await deleteValue(valueToDelete);
      setValueToDelete(null);
    }
  };

  const confirmDeleteGoal = async () => {
    if (goalToDelete) {
      await deleteGoal(goalToDelete);
      setGoalToDelete(null);
    }
  };

  const goalsByValue = values.map(value => ({
    value,
    goals: goals.filter(goal => goal.value_id === value.id)
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Add New Value */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Add New Value</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Add New Goal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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

      {/* Main Goals Container */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-lg font-semibold text-slate-200">Goals</h2>
          <div className="flex space-x-2">
            <span className="text-sm text-slate-400">
              {values.length} values • {goals.length} goals
            </span>
          </div>
        </div>

        {values.length === 0 ? (
          <p className="text-slate-400">No values yet. Add one above!</p>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Values and Goals by Category */}
            {goalsByValue.map(({ value, goals: valueGoals }) => (
              <div key={value.id}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-2 sm:space-y-0">
                  <h3 className="text-md font-medium text-forest-300 flex items-center">
                    <span className="mr-2">{getValueIcon(value.name)}</span>
                    {value.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowDeleteValueModal(true);
                      setValueToDelete(value.id);
                    }}
                    className="text-red-400 hover:text-red-300 text-sm transition-colors self-start sm:self-auto"
                  >
                    Delete Value
                  </button>
                </div>
                
                {valueGoals.length === 0 ? (
                  <p className="text-slate-400 ml-6">No goals for this value yet.</p>
                ) : (
                  <div className="space-y-2 ml-6">
                    {valueGoals.map(goal => (
                      <div key={goal.id} className="p-3 sm:p-4 border border-slate-600 rounded-lg bg-slate-700 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-200">{goal.name}</h4>
                            {goal.target_by && (
                              <p className="text-sm text-slate-400 mt-1">
                                Target: {new Date(goal.target_by).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setShowDeleteGoalModal(true);
                              setGoalToDelete(goal.id);
                            }}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors flex-shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showDeleteValueModal}
        onClose={() => {
          setShowDeleteValueModal(false);
          setValueToDelete(null);
        }}
        onConfirm={confirmDeleteValue}
        title="Delete Value"
        message="Are you sure you want to delete this value? This will also delete all associated goals."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonVariant="danger"
      />

      <ConfirmationModal
        isOpen={showDeleteGoalModal}
        onClose={() => {
          setShowDeleteGoalModal(false);
          setGoalToDelete(null);
        }}
        onConfirm={confirmDeleteGoal}
        title="Delete Goal"
        message="Are you sure you want to delete this goal?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonVariant="danger"
      />
    </div>
  );
} 