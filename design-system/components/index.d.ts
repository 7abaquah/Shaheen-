// مكونات شاهين — window.Shaheen
import * as React from "react";
export interface LogoProps { variant?: "lockup" | "mark" | "word"; tone?: "gradient" | "gold" | "black" | "white"; size?: number; label?: string }
export declare function Logo(props: LogoProps): JSX.Element;
export interface ButtonProps { variant?: "gold" | "ghost" | "quiet" | "danger"; children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: "button" | "submit"; className?: string }
export declare function Button(props: ButtonProps): JSX.Element;
export interface CardProps { title?: string; hint?: string; children?: React.ReactNode; className?: string }
export declare function Card(props: CardProps): JSX.Element;
export interface StatProps { label: string; value: React.ReactNode; sub?: string; tone?: "text" | "success" | "danger" | "info" }
export declare function Stat(props: StatProps): JSX.Element;
export interface StatusPillProps { tone?: "success" | "danger" | "info" | "gold" | "neutral"; children: React.ReactNode }
export declare function StatusPill(props: StatusPillProps): JSX.Element;
export interface NoticeProps { tone?: "info" | "ok" | "warn" | "err"; children: React.ReactNode }
export declare function Notice(props: NoticeProps): JSX.Element;
export interface ToggleProps { checked: boolean; onChange: (next: boolean) => void; label: string; id?: string }
export declare function Toggle(props: ToggleProps): JSX.Element;
export interface FieldProps { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: string; ltr?: boolean; invalid?: boolean; hint?: string }
export declare function Field(props: FieldProps): JSX.Element;
export interface ProgressProps { value: number; max?: number; label: string; tone?: "success" }
export declare function Progress(props: ProgressProps): JSX.Element;
export interface TalonDividerProps { size?: number }
export declare function TalonDivider(props: TalonDividerProps): JSX.Element;
