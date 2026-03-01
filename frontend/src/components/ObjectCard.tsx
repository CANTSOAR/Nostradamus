import React, { useState } from 'react';

interface Props {
    data: any;
    type: 'agent' | 'location' | 'org' | 'state';
    onEdit: (field: string, value: number) => void;
    onNavigate: (type: string, id: number) => void;
    onPin: (type: string, id: number) => void;
}

const EDITABLE_AGENT = ['wealth', 'income', 'health', 'speed', 'propensity_to_consume', 'age'];
const EDITABLE_STATE = ['state_tax_rate', 'fed_funds_rate'];

export default function ObjectCard({ data, type, onEdit, onNavigate, onPin }: Props) {
    const [editField, setEditField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const startEdit = (field: string, currentVal: any) => {
        setEditField(field);
        setEditValue(String(currentVal));
    };

    const saveEdit = () => {
        if (editField) {
            onEdit(editField, parseFloat(editValue));
            setEditField(null);
        }
    };

    const isEditable = (field: string) => {
        if (type === 'agent') return EDITABLE_AGENT.includes(field);
        if (type === 'state') return EDITABLE_STATE.includes(field);
        return false;
    };

    const renderValue = (key: string, val: any): React.ReactNode => {
        if (val === null || val === undefined) return <span className="val-null">—</span>;
        if (typeof val === 'object' && !Array.isArray(val)) {
            return <span className="val-obj">{JSON.stringify(val)}</span>;
        }
        if (Array.isArray(val)) {
            return (
                <span className="val-array">
                    {val.slice(0, 5).map((v, i) => (
                        <span key={i} className="link" onClick={() => onNavigate('agent', v)}>#{v}</span>
                    ))}
                    {val.length > 5 && <span>...+{val.length - 5}</span>}
                </span>
            );
        }
        // Navigable IDs
        if (key.includes('location_id') && typeof val === 'number') {
            return <span className="link" onClick={() => onNavigate('location', val)}>Location #{val}</span>;
        }
        if (key === 'organization_id' && typeof val === 'number') {
            return <span className="link" onClick={() => onNavigate('org', val)}>Org #{val}</span>;
        }
        if (typeof val === 'number') {
            return <span className="val-num">{key.includes('rate') || key.includes('health') || key.includes('disparity')
                ? `${(val * 100).toFixed(2)}%`
                : key.includes('wealth') || key.includes('income') || key.includes('value') || key.includes('funds') || key.includes('reserves') || key.includes('revenue') || key.includes('tax') || key.includes('economy')
                    ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : val.toLocaleString()
            }</span>;
        }
        if (typeof val === 'boolean') return <span className={`val-bool ${val ? 'true' : 'false'}`}>{val ? 'Yes' : 'No'}</span>;
        return <span>{String(val)}</span>;
    };

    return (
        <div className="object-card">
            <div className="card-header">
                <h3>{type === 'state' ? 'New Jersey' : type === 'agent' ? `Agent #${data.id}` : type === 'org' ? data.name : (data.name || `Location #${data.id}`)}</h3>
                {type !== 'state' && (
                    <div className="card-actions">
                        <button onClick={() => onPin(type, data.id)} title="Pin">Pin</button>
                    </div>
                )}
            </div>
            <div className="card-fields">
                {Object.entries(data).map(([key, val]) => {
                    if (key === 'destiny' || key === 'current_coord') return null;
                    return (
                        <div key={key} className="card-field">
                            <span className="field-key">{key}</span>
                            {editField === key ? (
                                <span className="field-edit">
                                    <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditField(null); }} autoFocus />
                                    <button onClick={saveEdit}>Save</button>
                                </span>
                            ) : (
                                <span className="field-value">
                                    {renderValue(key, val)}
                                    {isEditable(key) && <button className="edit-btn" onClick={() => startEdit(key, val)}>Edit</button>}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
