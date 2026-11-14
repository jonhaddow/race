import { describe, expect, it } from 'vitest';
import { advance, formatTime, lapsDone, order } from './race.ts';
import type { Track } from './track.ts';

const track = { length: 1000 } as Track;

describe('advance', () => {
	it('adds forward movement, across the line too', () => {
		expect(advance(track, 100, 100, 110)).toBe(110);
		expect(advance(track, 995, 995, 5)).toBe(1005);
	});
	it('takes away backward movement, across the line too', () => {
		expect(advance(track, 5, 5, 995)).toBe(-5);
	});
});

describe('lapsDone', () => {
	it('counts whole laps, none on the grid', () => {
		expect(lapsDone(track, -20)).toBe(0);
		expect(lapsDone(track, 999)).toBe(0);
		expect(lapsDone(track, 2001)).toBe(2);
	});
});

describe('order', () => {
	it('puts finishers first in finishing order, then by distance', () => {
		const ids = order([
			{ id: 0, progress: 2500 },
			{ id: 1, progress: 3000, finishedAt: 200 },
			{ id: 2, progress: 2900 },
			{ id: 3, progress: 3000, finishedAt: 190 }
		]).map((r) => r.id);
		expect(ids).toEqual([3, 1, 2, 0]);
	});
});

describe('formatTime', () => {
	it('shows minutes, seconds and hundredths', () => {
		expect(formatTime(75.456)).toBe('1:15.46');
		expect(formatTime(5)).toBe('0:05.00');
	});
});
