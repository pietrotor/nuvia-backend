// Who is putting the appointment in the agenda. The booking lead time exists so a client
// booking on her own cannot drop a treatment on the business with no warning; staff read
// the agenda and answer for the slot they pick, so for them the floor is the present
// moment. Every self-service surface — the agent and the booking page — is CLIENT.
export enum BookingActor {
  STAFF = 'staff',
  CLIENT = 'client',
}
