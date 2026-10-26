import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'firstpr',
    phase: 1,
    timestamp: new Date().toISOString(),
  });
}
