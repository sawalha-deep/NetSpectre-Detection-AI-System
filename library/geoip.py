import requests
import os
import argparse
import sys
import ipaddress
import subprocess   # ⭐ ADDED
import socket
import re
import pycountry

BLACK   = "\033[30m"
RED     = "\033[91m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
BLUE    = "\033[94m"
MAGENTA = "\033[95m"
CYAN    = "\033[96m"
WHITE   = "\033[97m"
RESET = "\033[0m"


def check_internet():
    try:
        requests.get("https://www.google.com", timeout=3)
        return True
    except requests.RequestException:
        return False

def resolve_domain(domain):
    try:
        return socket.gethostbyname(domain)
    except:
        error_msg("Failed to resolve domain")



def extract_whois_important(raw):
    info = {}

    patterns = {
        "org": [
            "org-name", "orgname", "organization", "descr", "owner"
        ],
        "country": [
            "country"
        ],
        "range": [
            "inetnum", "netrange"
        ],
        "cidr": [
            "cidr"
        ],
        "netname": [
            "netname"
        ],
        "asn": [
            "origin", "originas", "origin-as"
        ],
        "route": [
            "route"
        ],
        "abuse_email": [
            "abuse-mailbox", "orgabuseemail", "abuse"
        ],
        "tech_email": [
            "orgtechemail", "tech-c", "tech-email"
        ],
        "email": [
            "e-mail", "email"
        ],
        "address": [
            "address"
        ],
        "phone": [
            "phone", "tel"
        ]
    }

    for line in raw.splitlines():
        line = line.strip()

        if ":" not in line:
            continue

        key_part, value = line.split(":", 1)
        key_part = key_part.lower().strip()
        value = value.strip()

        for field, keys in patterns.items():
            if any(k in key_part for k in keys):
                # store first occurrence OR append if multiple
                if field in info:
                    if isinstance(info[field], list):
                        info[field].append(value)
                    else:
                        info[field] = [info[field], value]
                else:
                    info[field] = value

    return info
def get_whois(ip_or_domain):
    try:
        result = subprocess.check_output(["whois", ip_or_domain]).decode()
        return (extract_whois_important(result))
    except Exception as e:
        return str(e)

def error_msg(msg):
    if msg:
        print(f"[{RED}!{RESET}] Error: {RED}{msg}{RESET}")
    sys.exit()


def is_private_ip(ip):
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        error_msg("Invalid IP format")


def get_public_ip():
    try:
        r = requests.get("http://ip-api.com/json/", timeout=5)
        return r.json().get("query")
    except Exception:
        error_msg("Failed to fetch public IP")


def get_ip_data(ip):
    try:
        url = f"http://ip-api.com/json/{ip}"
        response = requests.get(url, timeout=5)

        if response.status_code != 200:
            error_msg("Unknown Error")

        data = response.json()

        if data.get("status") != "success":
            error_msg("Invalid IP or Not Found")

        return data

    except Exception as e:
        error_msg(str(e))




def country_to_flag(country_code: str) -> str:
    # Convert ISO alpha-2 code to flag emoji
    return chr(127397 + ord(country_code[0].upper())) + chr(127397 + ord(country_code[1].upper()))

def get_icons():
    icons = {}

    for country in pycountry.countries:
        code = country.alpha_2  # ISO 2-letter code
        icons[code.lower()] = country_to_flag(code)
        icons[country.name.lower()] = country_to_flag(code)

    return icons

def reverse_dns(ip):
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except:
        try:
            result = subprocess.check_output(["dig", "+short", "-x", ip]).decode().strip()
            return result if result else "N/A"
        except:
            return "N/A"
def print_pretty(data,info):
    icons = get_icons()
    s_icon="❌"
    if data.get('status') == "success":
        s_icon="✅"
   
    print(f"{GREEN}[*]{RESET} Status   : {s_icon} {data.get('status')}")
    icons = get_icons()
    print(f"{GREEN}[*]{RESET} IP       : 💻 {data.get('query')}")
    code = data.get("countryCode", "").lower()
    icon = icons.get(code, "")

    print(f"{GREEN}[*]{RESET} Country  : {icon} {data.get('country')}")
    print(f"{GREEN}[*]{RESET} Con-Code : 🧪 {data.get('countryCode')}")
    print(f"{GREEN}[*]{RESET} Region   : 🏳️  {data.get('regionName')}")
    print(f"{GREEN}[*]{RESET} City     : 🏙️  {data.get('city')}")
    if data.get('zip'):
        print(f"{GREEN}[*]{RESET} Zip      : 📮 {data.get('zip')}")
    print(f"{GREEN}[*]{RESET} ISP      : 🌍 {data.get('isp')}")
    print(f"{GREEN}[*]{RESET} Org      : 🏛️  {data.get('org')}")
    print(f"{GREEN}[*]{RESET} AS       : 🌐 {data.get('as')}")
    print(f"{GREEN}[*]{RESET} Lat/Lon  : 📍 {data.get('lat')}, {data.get('lon')}")
    print(f"{GREEN}[*]{RESET} Map      : 🎯 {CYAN}{generate_map_link(data.get('lat'), data.get('lon'))}{RESET}")
    print(f"{GREEN}[*]{RESET} Timezone : ⏰ {data.get('timezone')}")

    print(f"{GREEN}[*]{RESET} Mail     : 📧 {info.get('email', 'N/A')}")



def banner():
    return f"""{CYAN}
     ██▓ ██▓███     ▄▄▄█████▓ ██▀███   ▄▄▄       ▄████▄   ██ ▄█▀▓█████  ██▀███  
▓██▒▓██░  ██▒   ▓  ██▒ ▓▒▓██ ▒ ██▒▒████▄    ▒██▀ ▀█   ██▄█▒ ▓█   ▀ ▓██ ▒ ██▒
▒██▒▓██░ ██▓▒   ▒ ▓██░ ▒░▓██ ░▄█ ▒▒██  ▀█▄  ▒▓█    ▄ ▓███▄░ ▒███   ▓██ ░▄█ ▒
░██░▒██▄█▓▒ ▒   ░ ▓██▓ ░ ▒██▀▀█▄  ░██▄▄▄▄██ ▒▓▓▄ ▄██▒▓██ █▄ ▒▓█  ▄ ▒██▀▀█▄  
░██░▒██▒ ░  ░     ▒██▒ ░ ░██▓ ▒██▒ ▓█   ▓██▒▒ ▓███▀ ░▒██▒ █▄░▒████▒░██▓ ▒██▒
░▓  ▒▓▒░ ░  ░     ▒ ░░   ░ ▒▓ ░▒▓░ ▒▒   ▓▒█░░ ░▒ ▒  ░▒ ▒▒ ▓▒░░ ▒░ ░░ ▒▓ ░▒▓░
 ▒ ░░▒ ░            ░      ░▒ ░ ▒░  ▒   ▒▒ ░  ░  ▒   ░ ░▒ ▒░ ░ ░  ░  ░▒ ░ ▒░
 ▒ ░░░            ░        ░░   ░   ░   ▒   ░        ░ ░░ ░    ░     ░░   ░ 
 ░                          ░           ░  ░░ ░      ░  ░      ░  ░   ░     
                                            ░                               
    """


def generate_map_link(lat, lon):
    return f"https://www.google.com/maps?q={lat},{lon}"

def parse_whois(raw):
    info = {}

    for line in raw.splitlines():
        line = line.strip()

        if line.lower().startswith("country:"):
            info["country"] = line.split(":", 1)[1].strip()

        elif line.lower().startswith("org-name:"):
            info["org"] = line.split(":", 1)[1].strip()

        elif line.lower().startswith("netname:"):
            info["netname"] = line.split(":", 1)[1].strip()

        elif line.lower().startswith("inetnum:") or line.lower().startswith("netrange:"):
            info["range"] = line.split(":", 1)[1].strip()

        elif line.lower().startswith("originas:"):
            info["as"] = line.split(":", 1)[1].strip()

        elif line.lower().startswith("abuse-mailbox:") or "abuse@" in line.lower():
            if "abuse" not in info:
                info["abuse"] = line.split(":", 1)[-1].strip()

        elif line.lower().startswith("address:"):
            info.setdefault("address", line.split(":", 1)[1].strip())

        elif line.lower().startswith("route:"):
            info["route"] = line.split(":", 1)[1].strip()

    return info
def main():
    parser = argparse.ArgumentParser(description="IP Info Tool")
    parser.add_argument("-ip", required=True, help="Target IP address")
    parser.add_argument("-s", "--silent", action="store_true")
    parser.add_argument("-l", "--latlon", action="store_true")
    parser.add_argument("-ml", "--maplink", action="store_true")
    parser.add_argument("--isp", action="store_true")
    parser.add_argument("--country", action="store_true")
    parser.add_argument("--city", action="store_true")
    parser.add_argument("-d", "--domain", help="Target domain")
    parser.add_argument("--whois", action="store_true")
    parser.add_argument("--dns", action="store_true", help="Get reverse DNS")
    parser.add_argument("--out", action="store_true", help="without Banner")
    parser.add_argument("--mail", action="store_true", help="Try Get Mail Of Ip Provider")
    parser.add_argument("--all", action="store_true", help="Try All")
    args = parser.parse_args()

    if not check_internet():
        error_msg("Please Check Internet Connection")

    # -------------------------
    # STEP 1: DOMAIN HANDLING
    # -------------------------
    if args.domain:
        target = args.domain
        target_ip = resolve_domain(target)
    else:
        target_ip = args.ip
        target = target_ip

    # -------------------------
    # STEP 2: WHOIS (RUN EARLY)
    # -------------------------
    

    # -------------------------
    # STEP 3: PRIVATE IP CHECK
    # -------------------------
    if is_private_ip(target_ip):
        target_ip = get_public_ip()

    # -------------------------
    # STEP 4: GEO DATA
    # -------------------------
    data = get_ip_data(target_ip)
    info = get_whois(target_ip)

    lat = data.get("lat")
    lon = data.get("lon")
    isp = data.get("isp")
    country = data.get("country")
    city = data.get("city")
    mail=info.get('email', 'N/A')

    if sum([args.latlon, args.maplink, args.isp, args.country, args.city]) > 1:
        error_msg("Use only one option at a time")

    if args.silent:
        if args.latlon:
            print({"lat": lat, "lon": lon})
        elif args.maplink:
            print({"lat": lat, "lon": lon, "map": generate_map_link(lat, lon)})
        elif args.isp:
            print({"isp": isp})
        elif args.country:
            print({"country": country})
        elif args.city:
            print({"city": city})
        elif args.mail:
            print({"mail": info.get('email', 'N/A')})
        elif args.whois:
            #print("\n[*] WHOIS IMPORTANT DATA:\n")
            raw = get_whois(target)
            print(extract_whois_important(raw))
            sys.exit()
        elif  args.dns:
            rdns = reverse_dns(target_ip)
            if rdns != "N/A" and any(x in rdns for x in ["vpn", "proxy", "tor"]):
                
                print({"Suspicious DNS": rdns})
            
            print({"DNS": rdns})
        else:
            print(data)

    elif args.latlon:
        print(f"{GREEN}[*]{RESET} Lat : 📍 {lat}")
        print(f"{GREEN}[*]{RESET} Lon : 📍 {lon}")

    elif args.maplink:
        print(f"{GREEN}[*]{RESET} Lat : 📍 {lat}")
        print(f"{GREEN}[*]{RESET} Lon : 📍 {lon}")
        print(f"{GREEN}[*]{RESET} Map : 🎯 {CYAN}{generate_map_link(lat, lon)}{RESET}")

    elif args.isp:
        print(f"{GREEN}[*]{RESET}🌍 ISP : {isp}")
    elif args.country:
        icons = get_icons()
        code = data.get("countryCode", "").lower()
        icon = icons.get(code, "")

        print(f"{GREEN}[*]{RESET} Country : {icon} {country}")
    elif args.city:
        print(f"{GREEN}[*]{RESET} City : 🏙️ {city}")
    elif args.mail:
        print(f"{GREEN}[*]{RESET} Mail : 🏙️ {info.get('email', 'N/A')}")
    elif args.all:
        print_pretty(data,info)
        icons = get_icons()
        country_value = info.get("country", "")

        if isinstance(country_value, list):
            country_value = country_value[0]

        code = country_value.lower() if country_value else ""
        icon = icons.get(code, "🏳️")

        print(f"{GREEN}[*]{RESET} Country  : {icon} {info.get('country', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Org      : 🏛️  {info.get('org', 'N/A')}")
        print(f"{GREEN}[*]{RESET} NetName  : 🌐 {info.get('netname', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Range    : 📡 {info.get('range', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Route    : 🛣️  {info.get('route', 'N/A')}")
        print(f"{GREEN}[*]{RESET} AS       : 🌐 {info.get('as', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Abuse    : 📧 {info.get('abuse', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Address  : 🏢 {info.get('address', 'N/A')}")

    elif args.whois:
        #print("\n[*] WHOIS INFO:\n")
        raw = get_whois(target)
        #info = parse_whois(raw)
        
        icons = get_icons()
        code = info.get("country", "")
        icon = icons.get(code, "🏳️")

        print(f"{GREEN}[*]{RESET} Country  : {icon} {info.get('country', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Org      : 🏛️  {info.get('org', 'N/A')}")
        print(f"{GREEN}[*]{RESET} NetName  : 🌐 {info.get('netname', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Range    : 📡 {info.get('range', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Route    : 🛣️  {info.get('route', 'N/A')}")
        print(f"{GREEN}[*]{RESET} AS       : 🌐 {info.get('as', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Abuse    : 📧 {info.get('abuse', 'N/A')}")
        print(f"{GREEN}[*]{RESET} Address  : 🏢 {info.get('address', 'N/A')}")

        sys.exit()
    elif args.dns:
        rdns = reverse_dns(target_ip)
        if rdns != "N/A" and any(x in rdns for x in ["vpn", "proxy", "tor"]):
            print(f"{RED}[!] Suspicious DNS: {rdns}{RESET}")
        print(f"{GREEN}[*]{RESET} DNS : 🌐 {rdns}")
    else:
        import json
        if not args.out:
            os.system("clear")
            print(banner())
        
        info = get_whois(target_ip)
        #info = parse_whois(who_raw)
        print_pretty(data,info)
        #print(info)
if __name__ == "__main__":
    main()