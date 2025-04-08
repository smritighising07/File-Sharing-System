"""
Certificate Generator Using Existing Private Key

This script generates a certificate using your existing private key.
"""
import os
from OpenSSL import crypto

def create_cert_with_existing_key(private_key_path, cert_dir="ssl_certs", cert_file="cert.pem"):
    """
    Creates a certificate using an existing private key
    """
    print(f"Using existing private key: {private_key_path}")
    
    # Create directory if it doesn't exist
    if not os.path.exists(cert_dir):
        os.makedirs(cert_dir)
        print(f"Created directory: {cert_dir}")
        
    cert_path = os.path.join(cert_dir, cert_file)
    key_path = os.path.join(cert_dir, "key.pem")
    
    # Read the private key
    try:
        with open(private_key_path, 'rb') as key_file:
            key_data = key_file.read()
            
        # Load the private key
        try:
            pkey = crypto.load_privatekey(crypto.FILETYPE_PEM, key_data)
            print("Private key loaded successfully")
        except Exception as e:
            # Try with a passphrase if loading fails
            passphrase = input("Enter passphrase for private key (leave empty if none): ")
            if passphrase:
                pkey = crypto.load_privatekey(crypto.FILETYPE_PEM, key_data, 
                                            passphrase.encode('utf-8'))
                print("Private key loaded successfully with passphrase")
            else:
                raise e
                
        # Create a self-signed cert
        cert = crypto.X509()
        cert.get_subject().C = "NP"  # Country - Nepal
        cert.get_subject().ST = "Bagmati"  # State
        cert.get_subject().L = "Kathmandu"  # Locality
        cert.get_subject().O = "Secure FileShare"  # Organization
        cert.get_subject().OU = "IT Department"  # Organizational Unit
        cert.get_subject().CN = "localhost"  # Common Name
        cert.set_serial_number(1000)
        cert.gmtime_adj_notBefore(0)
        cert.gmtime_adj_notAfter(10*365*24*60*60)  # 10 years validity
        cert.set_issuer(cert.get_subject())
        cert.set_pubkey(pkey)
        cert.sign(pkey, 'sha256')
        
        # Write certificate to file
        with open(cert_path, "wb") as cert_file:
            cert_file.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
        
        # Copy the private key to our ssl_certs directory
        with open(key_path, "wb") as key_file_out:
            key_file_out.write(key_data)
        
        print(f"SSL certificate created successfully:")
        print(f"- Certificate: {os.path.abspath(cert_path)}")
        print(f"- Private Key (copied): {os.path.abspath(key_path)}")
        print("\nThese files will be automatically used by your Flask application.")
        
        return True
    except Exception as e:
        print(f"Error creating certificate: {e}")
        return False

if __name__ == "__main__":
    private_key_path = input("Enter path to your private key file (e.g., C:\\Users\\Asus\\private.key): ")
    if not os.path.exists(private_key_path):
        print(f"Error: Private key not found at {private_key_path}")
    else:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        ssl_dir = os.path.join(current_dir, 'ssl_certs')
        create_cert_with_existing_key(private_key_path, ssl_dir)