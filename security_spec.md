# Security Specification - Exam Proctoring System

## Data Invariants
- A Teacher must have a name and specialty.
- An Exam must have a subject, date, period, and valid counts for halls/proctors.
- An Assignment must link a valid Teacher to a valid Exam and Hall.
- Only Admins (users in the `/admins` collection) can create/update/delete data.
- All users (authenticated) can read data.

## The Dirty Dozen Payloads (Target: DENIED)
1. **Identity Spoofing**: Attempt to create a teacher identifying as another UID.
2. **Ghost Field**: Adding `isVerified: true` to a teacher document.
3. **Orphaned Assignment**: Creating an assignment for an exam that doesn't exist.
4. **Self-Promotion**: A regular user trying to add themselves to the `/admins` collection.
5. **Invalid ID**: Using a 2KB string as a document ID.
6. **Negative Hours**: Setting totalHours to -10.
7. **Subject Proctoring**: (This is business logic, but rules should technically enforce specialty mismatch if possible - hard to do in rules without complex gets, so we'll enforce it in code, but proctor assignment link must be valid).
8. **Unauthorized Update**: A teacher trying to change another teacher's specialty.
9. **Bulk Delete**: A non-admin trying to clear the assignments collection.
10. **Shadow Exams**: Creating an exam with 0 proctors required.
11. **Type Poisoning**: Sending a string for `hallCount`.
12. **Future Date Injection**: Setting `createdAt` to a client-side timestamp in the future.

## Test Runner (Conceptual)
Tests would verify that:
- `setDoc(doc(db, 'teachers', 'T1'), { name: 'Dr. Smith', specialty: 'Math' })` fails if not admin.
- `updateDoc(doc(db, 'exams', 'E1'), { subject: 'Physics' })` fails if not admin.
- `getDocs(collection(db, 'admins'))` is only allowed for the individual admin or protected.
