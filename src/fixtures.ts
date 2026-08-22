import { LetterResult } from './types';

/**
 * The six test letters from blueprint section 8.
 *
 * These are MOCK documents. No real senior's mail is in this repo and none
 * should ever be. Each carries the expected result so the viability test can
 * be scored automatically rather than by eyeballing a card.
 *
 * Fixtures 2 and 6 are the E2B viability test — run them before building
 * anything else. `trap` names the specific wrong answer to watch for.
 */
export interface Fixture {
  id: number;
  name: string;
  /** Plain text of the letter, for the text-only fallback in section 4
   *  mitigation 4 and for scoring without a camera. */
  text: string;
  expected: LetterResult;
  trap: string;
  /** True for the two that gate the whole day. */
  viabilityGate?: boolean;
}

export const FIXTURES: Fixture[] = [
  {
    id: 1,
    name: 'CPF credit',
    text: `CENTRAL PROVIDENT FUND BOARD
79 Robinson Road, Singapore 068897

NOTICE OF CREDIT TO YOUR RETIREMENT ACCOUNT

Dear Mr TAN AH KOW,

We are pleased to inform you that a sum of S$450.00 has been CREDITED to
your CPF Retirement Account on 5 August 2026 under the Majulah Package
Earn-and-Save Bonus.

Your updated Retirement Account balance is S$62,318.40.

No action is required on your part. This letter is for your information
only. You do not need to reply or make any payment.

This is a computer-generated letter. No signature is required.`,
    expected: {
      status: 'INFO_ONLY',
      sender: 'Central Provident Fund Board',
      summary_english:
        'CPF has put S$450 into your Retirement Account. This is money you received, not money you owe.',
      action_items: [],
      amount_due: 'NIL',
      deadline: null,
      source_quote:
        'a sum of S$450.00 has been CREDITED to your CPF Retirement Account',
    },
    trap: 'Reading S$450 as money owed rather than received.',
  },
  {
    id: 2,
    name: 'Polyclinic reschedule',
    viabilityGate: true,
    text: `NATIONAL HEALTHCARE GROUP POLYCLINICS
Ang Mo Kio Polyclinic

APPOINTMENT RESCHEDULE NOTICE

Dear Mr TAN AH KOW (S1234567D),

Your appointment on 18 August 2026, 9.30am has been CANCELLED as the
attending doctor is on medical leave.

Your NEW appointment is confirmed for:
    Thursday, 27 August 2026 at 10.15am
    Consultation Room 4, Level 2

Please arrive 15 minutes early for registration. Bring your NRIC and
appointment card. Consultation is covered under your CHAS subsidy; no
payment is required at registration.

To change this appointment call 6355 3000.`,
    expected: {
      status: 'ACTION_REQUIRED',
      sender: 'Ang Mo Kio Polyclinic',
      summary_english:
        'Your 18 August appointment was cancelled. Your new appointment is 27 August 2026 at 10.15am.',
      action_items: [
        'Attend Ang Mo Kio Polyclinic on 27 August 2026 at 10.15am',
        'Bring NRIC and appointment card',
      ],
      amount_due: 'NIL',
      deadline: '2026-08-27',
      source_quote:
        'Your NEW appointment is confirmed for: Thursday, 27 August 2026 at 10.15am',
    },
    trap:
      'Reporting the CANCELLED 18 August date. Most dangerous error in the set — it sends a senior to the clinic on the wrong day.',
  },
  {
    id: 3,
    name: 'Town council arrears',
    text: `ANG MO KIO TOWN COUNCIL
Blk 724 Ang Mo Kio Ave 6 #01-4222

SERVICE & CONSERVANCY CHARGES - REMINDER

Dear Resident of BLK 715 ANG MO KIO AVE 6 #08-142,

Our records show the following outstanding amounts:

    June 2026 S&CC                        S$ 44.00
    July 2026 S&CC                        S$ 44.00
    August 2026 S&CC                      S$ 44.00
    --------------------------------------------
    TOTAL AMOUNT OUTSTANDING              S$132.00

Please settle the TOTAL amount of S$132.00 by 31 August 2026 at any AXS
station, or at our office during working hours.

If you are facing financial difficulty, please approach our office. Help
schemes are available and we will not disconnect essential services.`,
    expected: {
      status: 'ACTION_REQUIRED',
      sender: 'Ang Mo Kio Town Council',
      summary_english:
        'You owe S$132.00 in service and conservancy charges for June, July and August. Pay by 31 August 2026.',
      action_items: [
        'Pay S$132.00 at an AXS station or the town council office',
      ],
      amount_due: 'S$132.00',
      deadline: '2026-08-31',
      source_quote: 'Please settle the TOTAL amount of S$132.00 by 31 August 2026',
    },
    trap: 'Reporting one S$44.00 line item instead of the S$132.00 total.',
  },
  {
    id: 4,
    name: 'CHAS renewal',
    text: `MINISTRY OF HEALTH
COMMUNITY HEALTH ASSIST SCHEME (CHAS)

CHAS CARD RENEWAL NOTICE

Dear Mr TAN AH KOW,

Your CHAS Orange card expires on 30 September 2026.

To continue receiving subsidised treatment at participating GP and dental
clinics, please renew before this date. You may renew:
    - online at chas.sg
    - at any Community Centre with your NRIC
    - by calling 1800 275 2427

RENEWAL IS FREE OF CHARGE. There is no fee to renew your CHAS card and we
will never ask you to pay to process this renewal.

If you do not renew, your subsidies will stop on 1 October 2026.`,
    expected: {
      status: 'ACTION_REQUIRED',
      sender: 'Ministry of Health (CHAS)',
      summary_english:
        'Your CHAS Orange card expires on 30 September 2026. Renew it before then to keep your clinic subsidies. Renewal is free.',
      action_items: [
        'Renew CHAS card online at chas.sg, at a Community Centre, or by phone',
      ],
      amount_due: 'FREE',
      deadline: '2026-09-30',
      source_quote:
        'RENEWAL IS FREE OF CHARGE. There is no fee to renew your CHAS card',
    },
    trap: 'Implying a fee where there is none.',
  },
  {
    id: 5,
    name: 'Fake agency demand',
    text: `SINGAPORE GOVERNMENT ENFORCEMENT DEPARTMENT
Case Reference: SG-ENF-2026-88431

FINAL NOTICE - IMMEDIATE ACTION REQUIRED

Dear Sir/Madam,

Our investigation has linked your NRIC to a money laundering case. Your
bank accounts will be FROZEN and a warrant of arrest issued within 24
HOURS unless this matter is resolved.

To clear your name you must transfer S$8,500 as a security deposit to the
following account for verification:

    Account Name: LIM WEI SENG
    Account Number: 3821-99274-1
    Bank: OCBC

DO NOT DISCUSS THIS CASE WITH FAMILY MEMBERS OR ANY OTHER PERSON. This is
a confidential investigation and disclosure is an offence under the
Official Secrets Act.

Failure to comply will result in immediate arrest.`,
    expected: {
      status: 'SCAM_ALERT',
      sender: 'Unknown — not a real government agency',
      summary_english:
        'This is a scam. Real agencies never demand transfers to a personal bank account, never give 24-hour ultimatums, and never tell you to keep it secret from your family.',
      action_items: [
        'Do not transfer any money',
        'Tell a family member or neighbour now',
        'Call the ScamShield helpline 1799',
      ],
      amount_due: 'NIL',
      deadline: null,
      source_quote:
        'DO NOT DISCUSS THIS CASE WITH FAMILY MEMBERS OR ANY OTHER PERSON',
    },
    trap:
      'Summarising it as a real bill. If this happens the demo is a liability, not a product.',
  },
  {
    id: 6,
    name: 'Lift closure',
    viabilityGate: true,
    text: `ANG MO KIO TOWN COUNCIL
NOTICE TO RESIDENTS - BLK 715

LIFT MAINTENANCE: LIFT B (SERVING FLOORS 8 TO 15)

Lift B will be out of service for annual safety inspection on:
    Tuesday, 25 August 2026, 9.00am to 5.00pm

Lift A remains in service throughout and serves all floors.

Residents on floors 8 to 15 who use a wheelchair, or who cannot manage
the walk to Lift A, should call our office at 6453 8000 before 25 August
so we can arrange assistance on the day.

All other residents need not take any action. We apologise for the
inconvenience.`,
    expected: {
      status: 'CONDITIONAL',
      sender: 'Ang Mo Kio Town Council',
      summary_english:
        'Lift B is closed on 25 August 2026 from 9am to 5pm. Lift A still works. Only call the office beforehand if you use a wheelchair or cannot walk to Lift A.',
      action_items: [
        'If you use a wheelchair or cannot manage the walk to Lift A, call 6453 8000 before 25 August 2026',
      ],
      amount_due: 'NIL',
      deadline: '2026-08-25',
      source_quote:
        'Residents on floors 8 to 15 who use a wheelchair, or who cannot manage the walk to Lift A, should call our office',
    },
    trap:
      'Flattening the conditional either way — into "nothing to do" or into "you must call".',
  },
];

/** The two that gate the day. Section 10: run these at 09:00, before UI. */
export const GATE_FIXTURES = FIXTURES.filter((f) => f.viabilityGate);
