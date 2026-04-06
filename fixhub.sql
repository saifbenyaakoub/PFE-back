CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profile_image TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'provider')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE providers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_category VARCHAR(255),
    city VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
    CONSTRAINT services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);
CREATE TABLE tasks (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    image_url TEXT,
    description TEXT NOT NULL,
    category VARCHAR(255),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tasks_status_check CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE TABLE proposals (
  id          SERIAL PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  amount      DECIMAL(10,2),                    
  message     TEXT,                             
  status      VARCHAR(20) DEFAULT 'pending',    
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, provider_id)                   
);

CREATE INDEX idx_proposals_task_id ON proposals(task_id);
CREATE INDEX idx_proposals_provider_id ON proposals(provider_id);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_providers_user_id ON providers(user_id);

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL
        REFERENCES services(id) ON DELETE CASCADE,
    amount DECIMAL(10,2),
    client_id INTEGER NOT NULL
        REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    details TEXT,
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(booking_id)
);

CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);
CREATE INDEX idx_reviews_client ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);

ALTER TABLE services 
ADD CONSTRAINT unique_provider_service_title UNIQUE (provider_id, title);

ALTER TABLE messages
ADD COLUMN status VARCHAR(50)
CHECK (status IN ('pending', 'accepted', 'declined'))
DEFAULT 'pending';