/**
 * Sikka ONE API Integration Tests
 *
 * Tests for the Sikka dental practice management integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sikka, toStandardContact, toStandardEvent } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Sikka Constructor', () => {
	it('should require App ID', () => {
		expect(() => new Sikka({ appId: '', appKey: 'test-key' })).toThrow('Sikka App ID is required');
	});

	it('should require App Key', () => {
		expect(() => new Sikka({ appId: 'test-id', appKey: '' })).toThrow('Sikka App Key is required');
	});

	it('should create instance with valid credentials', () => {
		const sikka = new Sikka({ appId: 'test-id', appKey: 'test-key' });
		expect(sikka).toBeInstanceOf(Sikka);
	});

	it('should allow custom API URL', () => {
		const sikka = new Sikka({
			appId: 'test-id',
			appKey: 'test-key',
			apiUrl: 'https://custom-api.sikkasoft.com/v4',
		});
		expect(sikka).toBeInstanceOf(Sikka);
	});

	it('should accept optional pre-fetched request key', () => {
		const sikka = new Sikka({
			appId: 'test-id',
			appKey: 'test-key',
			requestKey: 'd7ab733c766917fa5ef8ae3a54100620',
		});
		expect(sikka).toBeInstanceOf(Sikka);
		expect(sikka.hasValidRequestKey()).toBe(true);
	});
});

describe('Sikka Authentication', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-app-id', appKey: 'test-app-key' });
		mockFetch.mockReset();
	});

	it('should use App-Id and App-Key headers for getAuthorizedPractices', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ items: [] }),
		});

		await sikka.getAuthorizedPractices();

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/authorized_practices'),
			expect.objectContaining({
				headers: expect.any(Headers),
			})
		);

		const [, requestOptions] = mockFetch.mock.calls[0];
		const headers = requestOptions.headers;
		expect(headers.get('App-Id')).toBe('test-app-id');
		expect(headers.get('App-Key')).toBe('test-app-key');
	});

	it('should use request-key header for data endpoints', async () => {
		// Create sikka with pre-fetched request key
		const sikkaWithKey = new Sikka({
			appId: 'test-app-id',
			appKey: 'test-app-key',
			requestKey: 'd7ab733c766917fa5ef8ae3a54100620',
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ items: [] }),
		});

		await sikkaWithKey.getPatients({ practiceId: 'test-practice' });

		const [, requestOptions] = mockFetch.mock.calls[0];
		const headers = requestOptions.headers;
		expect(headers.get('request-key')).toBe('d7ab733c766917fa5ef8ae3a54100620');
	});

	it('should obtain request key from practice credentials', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				request_key: 'new-request-key-12345',
				expires_in: '86400 second(s)',
				status: 'active',
			}),
		});

		const result = await sikka.obtainRequestKey({
			office_id: 'D12345',
			secret_key: 'secret123',
		});

		expect(result.success).toBe(true);
		expect(result.data.request_key).toBe('new-request-key-12345');
		expect(sikka.hasValidRequestKey()).toBe(true);
	});
});

describe('Sikka Practices', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get authorized practices', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						practice_id: 'practice-123',
						practice_name: 'Smile Dental',
						practice_city: 'Austin',
						practice_state: 'TX',
						pms_type: 'Dentrix',
					},
				],
			}),
		});

		const result = await sikka.getAuthorizedPractices();

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].practice_name).toBe('Smile Dental');
		expect(result.data[0].pms_type).toBe('Dentrix');
	});

	it('should get single practice', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					practice_id: 'practice-123',
					practice_name: 'Smile Dental',
					practice_address: '123 Main St',
					practice_city: 'Austin',
					practice_state: 'TX',
					practice_zip: '78701',
				},
			}),
		});

		const result = await sikka.getPractice('practice-123');

		expect(result.success).toBe(true);
		expect(result.data.practice_id).toBe('practice-123');
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/practices/practice-123'),
			expect.any(Object)
		);
	});
});

describe('Sikka Patients', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get patients with practice ID', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						patient_id: 'patient-123',
						practice_id: 'practice-123',
						first_name: 'John',
						last_name: 'Doe',
						email: 'john@example.com',
						phone_cell: '555-1234',
						status: 'active',
					},
				],
			}),
		});

		const result = await sikka.getPatients({ practiceId: 'practice-123' });

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].first_name).toBe('John');
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('practice_id=practice-123'),
			expect.any(Object)
		);
	});

	it('should support incremental sync with modifiedSince', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ data: [] }),
		});

		const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		await sikka.getPatients({
			practiceId: 'practice-123',
			modifiedSince: lastWeek,
		});

		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain('loaded_startdate=');
	});

	it('should limit results to API maximum of 5000', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ data: [] }),
		});

		await sikka.getPatients({
			practiceId: 'practice-123',
			limit: 10000, // Request more than max
		});

		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain('limit=5000'); // Should be capped at 5000
	});

	it('should get single patient', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					patient_id: 'patient-123',
					practice_id: 'practice-123',
					first_name: 'Jane',
					last_name: 'Smith',
					balance: 150.00,
				},
			}),
		});

		const result = await sikka.getPatient('practice-123', 'patient-123');

		expect(result.success).toBe(true);
		expect(result.data.first_name).toBe('Jane');
		expect(result.data.balance).toBe(150.00);
	});

	it('should search patients', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{ patient_id: 'p1', first_name: 'John', last_name: 'Smith' },
					{ patient_id: 'p2', first_name: 'Johnny', last_name: 'Doe' },
				],
			}),
		});

		const result = await sikka.searchPatients('practice-123', 'John');

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
	});
});

describe('Sikka Appointments', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get appointments with date range', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						appointment_id: 'apt-123',
						practice_id: 'practice-123',
						patient_id: 'patient-456',
						appointment_date: '2024-01-15',
						appointment_time: '09:00',
						duration_minutes: 60,
						status: 'scheduled',
						appointment_type: 'Cleaning',
					},
				],
			}),
		});

		const result = await sikka.getAppointments({
			practiceId: 'practice-123',
			startDate: new Date('2024-01-15'),
			endDate: new Date('2024-01-15'),
		});

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].appointment_type).toBe('Cleaning');
	});

	it('should get today\'s appointments', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{ appointment_id: 'apt-1', status: 'scheduled' },
					{ appointment_id: 'apt-2', status: 'confirmed' },
					{ appointment_id: 'apt-3', status: 'checked_in' },
				],
			}),
		});

		const result = await sikka.getTodaysAppointments('practice-123');

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(3);
	});

	it('should filter appointments by status', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ data: [] }),
		});

		await sikka.getAppointments({
			practiceId: 'practice-123',
			status: 'no_show',
		});

		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain('status=no_show');
	});

	it('should get patient appointments', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{ appointment_id: 'apt-1', patient_id: 'patient-123' },
				],
			}),
		});

		const result = await sikka.getPatientAppointments('practice-123', 'patient-123');

		expect(result.success).toBe(true);
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain('patient_id=patient-123');
	});
});

describe('Sikka Providers', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get providers', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						provider_id: 'prov-123',
						practice_id: 'practice-123',
						first_name: 'Dr. Sarah',
						last_name: 'Johnson',
						provider_type: 'DDS',
						is_active: true,
					},
				],
			}),
		});

		const result = await sikka.getProviders('practice-123');

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.data[0].provider_type).toBe('DDS');
	});
});

describe('Sikka Treatments', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get treatments', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						treatment_id: 'tx-123',
						practice_id: 'practice-123',
						patient_id: 'patient-456',
						procedure_code: 'D1110',
						procedure_description: 'Prophylaxis - Adult',
						fee: 150.00,
						status: 'completed',
					},
				],
			}),
		});

		const result = await sikka.getTreatments({ practiceId: 'practice-123' });

		expect(result.success).toBe(true);
		expect(result.data[0].procedure_code).toBe('D1110');
	});

	it('should get pending treatments for a patient', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{ treatment_id: 'tx-1', status: 'planned', fee: 500 },
					{ treatment_id: 'tx-2', status: 'planned', fee: 300 },
				],
			}),
		});

		const result = await sikka.getPendingTreatments('practice-123', 'patient-456');

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain('status=planned');
	});
});

describe('Sikka Claims', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get claims', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						claim_id: 'claim-123',
						practice_id: 'practice-123',
						patient_id: 'patient-456',
						insurance_carrier: 'Delta Dental',
						amount_billed: 500.00,
						amount_paid: 400.00,
						status: 'paid',
					},
				],
			}),
		});

		const result = await sikka.getClaims({ practiceId: 'practice-123' });

		expect(result.success).toBe(true);
		expect(result.data[0].insurance_carrier).toBe('Delta Dental');
	});
});

describe('Sikka Transactions', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should get transactions', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: [
					{
						transaction_id: 'txn-123',
						practice_id: 'practice-123',
						patient_id: 'patient-456',
						transaction_type: 'payment',
						amount: 150.00,
						payment_method: 'credit_card',
						transaction_date: '2024-01-15',
					},
				],
			}),
		});

		const result = await sikka.getTransactions({
			practiceId: 'practice-123',
			transactionType: 'payment',
		});

		expect(result.success).toBe(true);
		expect(result.data[0].amount).toBe(150.00);
	});
});

describe('Sikka Write Operations', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should create appointment', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					appointment_id: 'apt-new',
					practice_id: 'practice-123',
					patient_id: 'patient-456',
					appointment_date: '2024-01-20',
					appointment_time: '10:00',
					status: 'scheduled',
				},
			}),
		});

		const result = await sikka.createAppointment({
			practiceId: 'practice-123',
			patientId: 'patient-456',
			appointmentDate: new Date('2024-01-20'),
			appointmentTime: '10:00',
			appointmentType: 'Cleaning',
		});

		expect(result.success).toBe(true);
		expect(result.data.appointment_id).toBe('apt-new');
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/appointments'),
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('should update appointment status', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					appointment_id: 'apt-123',
					status: 'confirmed',
				},
			}),
		});

		const result = await sikka.updateAppointmentStatus({
			practiceId: 'practice-123',
			appointmentId: 'apt-123',
			status: 'confirmed',
		});

		expect(result.success).toBe(true);
		expect(result.data.status).toBe('confirmed');
	});
});

describe('Sikka Error Handling', () => {
	let sikka: Sikka;

	beforeEach(() => {
		sikka = new Sikka({ appId: 'test-id', appKey: 'test-key', requestKey: 'test-request-key' });
		mockFetch.mockReset();
	});

	it('should handle authentication error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: async () => 'Invalid API credentials',
		});

		const result = await sikka.getAuthorizedPractices();

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('api_error');
	});

	it('should handle rate limit error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 429,
			statusText: 'Too Many Requests',
			json: async () => ({ message: 'Rate limit exceeded' }),
		});

		const result = await sikka.getPatients({ practiceId: 'practice-123' });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('api_error');
	});

	it('should handle not found error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: 'Not Found',
			json: async () => ({ message: 'Practice not found' }),
		});

		const result = await sikka.getPractice('nonexistent');

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('not_found');
	});

	it('should handle network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await sikka.getAuthorizedPractices();

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('network_error');
	});

	it('should handle timeout', async () => {
		mockFetch.mockImplementationOnce(() => {
			const error = new Error('Aborted');
			error.name = 'AbortError';
			throw error;
		});

		const result = await sikka.getAuthorizedPractices();

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('timeout');
	});
});

describe('Sikka Standard Data Converters', () => {
	it('should convert patient to standard contact', () => {
		const patient = {
			patient_id: 'patient-123',
			practice_id: 'practice-123',
			first_name: 'John',
			last_name: 'Doe',
			email: 'john@example.com',
			phone_cell: '555-1234',
			date_of_birth: '1985-03-15',
			last_visit_date: '2024-01-10',
			next_appointment_date: '2024-02-15',
			balance: 75.00,
		};

		const contact = toStandardContact(patient);

		expect(contact.id).toBe('patient-123');
		expect(contact.firstName).toBe('John');
		expect(contact.lastName).toBe('Doe');
		expect(contact.email).toBe('john@example.com');
		expect(contact.phone).toBe('555-1234');
		expect(contact.source).toBe('sikka');
		expect(contact.metadata.balance).toBe(75.00);
	});

	it('should prefer cell phone over other phone types', () => {
		const patient = {
			patient_id: 'p1',
			practice_id: 'pr1',
			first_name: 'Jane',
			last_name: 'Smith',
			phone_home: '555-1111',
			phone_cell: '555-2222',
			phone_work: '555-3333',
		};

		const contact = toStandardContact(patient);

		expect(contact.phone).toBe('555-2222');
	});

	it('should convert appointment to standard event', () => {
		const appointment = {
			appointment_id: 'apt-123',
			practice_id: 'practice-123',
			patient_id: 'patient-456',
			appointment_date: '2024-01-15',
			appointment_time: '09:00',
			duration_minutes: 60,
			status: 'scheduled' as const,
			appointment_type: 'Cleaning',
			procedure_codes: ['D1110'],
			notes: 'Regular checkup',
		};

		const event = toStandardEvent(appointment);

		expect(event.id).toBe('apt-123');
		expect(event.title).toBe('Cleaning');
		expect(event.status).toBe('scheduled');
		expect(event.source).toBe('sikka');
		expect(event.metadata.procedureCodes).toContain('D1110');
	});

	it('should calculate end time from duration', () => {
		const appointment = {
			appointment_id: 'apt-123',
			practice_id: 'practice-123',
			patient_id: 'patient-456',
			appointment_date: '2024-01-15',
			appointment_time: '09:00',
			duration_minutes: 30,
			status: 'scheduled' as const,
		};

		const event = toStandardEvent(appointment);

		const startDate = new Date(event.start);
		const endDate = new Date(event.end);
		const durationMs = endDate.getTime() - startDate.getTime();
		const durationMinutes = durationMs / (60 * 1000);

		expect(durationMinutes).toBe(30);
	});
});
