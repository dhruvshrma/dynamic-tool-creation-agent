import { ITool } from "./toolInterface";

export class WeatherTool implements ITool {
  public name: string = "weather";
  public description: string = "Get the weather for a specific location. Can optionally specify units and a time (ISO 8601 format).";
  public parametersSchema: any = {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city and state, e.g. San Francisco, CA",
      },
      units: {
        type: "string",
        description: "The units for temperature, either 'metric' (Celsius) or 'imperial' (Fahrenheit). Defaults to metric if not specified and a specific time is not given, or imperial if a specific historic time is given for US locations.",
        enum: ["metric", "imperial"],
      },
      time: {
        type: "string",
        description: "The ISO 8601 date-time string for which to get the weather. If not provided, current weather is assumed.",
        format: "date-time",
      },
    },
    required: ["location"],
  };
  
  // Mock weather data 
  private mockWeatherData = [
    {
      location: "New York",
      units: "imperial",
      time: "2025-05-15T00:00:00Z",
      weather: "sunny",
      temperature: 60,
    }, 
    {
      location: "Paris",
      units: "metric",
      time: "2025-05-15T00:00:00Z",
      weather: "cloudy",
      temperature: 15,
    },
    {
      location: "London",
      units: "metric",
      // No specific time, implies current weather for this mock entry
      weather: "rainy",
      temperature: 10,
    }
  ];

  // Adjusted getWeather to be more flexible with optional parameters
  private getWeather(location: string, units?: string, time?: string): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const foundData = this.mockWeatherData.find(data => {
          // Make location matching more flexible: check if the mock location is part of the provided location string
          let matches = location.toLowerCase().includes(data.location.toLowerCase());
          if (units) {
            matches = matches && data.units === units;
          }
          if (time) {
            matches = matches && data.time === time;
          } else {
            // If no time is specified by user, this entry should either not have a time OR its time is irrelevant for a current weather request
            // For simplicity with current mock data: if user wants current weather, prefer entries without a specific historic time.
            matches = matches && !data.time; 
          }
          return matches;
        });

        // Fallback for current weather if only location matches and the specific entry had a time (which failed the !data.time check above)
        // OR if the primary match just failed but location might be good.
        if (!foundData && !time) { 
            const fallbackMatch = this.mockWeatherData.find(data => 
                location.toLowerCase().includes(data.location.toLowerCase()) &&
                (!units || data.units === units) // Match units if specified
                // We don't care about data.time here, as user wants current and primary failed. Pick first match by location.
            );
            if (fallbackMatch) {
                // Return a version of fallbackMatch that implies current weather (strip specific time if it had one)
                const { time: mockTime, ...currentWeather } = fallbackMatch;
                resolve(currentWeather);
                return;
            }
        }
        resolve(foundData || { error: "Weather data not found for the specified criteria." });
      }, 500);
    });
  }

  public async execute(args: string): Promise<string> {
    try {
      const params = JSON.parse(args);
      if (!params.location || typeof params.location !== 'string') {
        return JSON.stringify({ error: "Invalid arguments. 'location' property must be a string and is required." });
      }
      // Units and time are optional according to schema if not in `required` array.
      // However, our mock data might require them for specific entries.
      const { location, units, time } = params;
      
      console.log(`WeatherTool: Searching for location: ${location}, units: ${units}, time: ${time}`);
      const weatherData = await this.getWeather(location, units, time);
      
      if (weatherData && weatherData.error) {
        console.warn(`WeatherTool: Data not found for ${location}. Returning error message.`);
      }
      return JSON.stringify(weatherData);
    } catch (error: any) {
      console.error(`WeatherTool: Error during execution: ${error.message}`)
      return JSON.stringify({ error: "Failed to parse arguments or get weather data: " + error.message });
    }
  }
}

export const weatherTool = new WeatherTool();