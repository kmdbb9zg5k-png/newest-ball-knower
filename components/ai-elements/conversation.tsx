'use client';

import {cn} from '@/lib/utils';
import type {ComponentProps} from 'react';
import {StickToBottom} from 'use-stick-to-bottom';

// Installed from the official AI Elements conversation registry and trimmed to
// its accessible auto-scrolling container; download controls are intentionally
// omitted because Ask BK conversations are session-only.
export type ConversationProps=ComponentProps<typeof StickToBottom>;
export const Conversation=({className,...props}:ConversationProps)=><StickToBottom className={cn('relative flex-1 overflow-y-hidden',className)} initial="smooth" resize="smooth" role="log" {...props}/>;

export type ConversationContentProps=ComponentProps<typeof StickToBottom.Content>;
export const ConversationContent=({className,...props}:ConversationContentProps)=><StickToBottom.Content className={cn('flex flex-col gap-5 p-4',className)} {...props}/>;
